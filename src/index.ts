import express from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AutoScalingClient, DescribeAutoScalingGroupsCommand, SetDesiredCapacityCommand } from "@aws-sdk/client-auto-scaling";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ========= CONFIG =========
const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLE_NAME = process.env.TABLE_NAME || "machine_pool";
const ASG_NAME = process.env.ASG_NAME || "on-demand-machine-asg";

const LEASE_TTL_MS = 10 * 60 * 1000; // 10 min
const HEARTBEAT_MAX_AGE_MS = 60 * 1000; // if no heartbeat in 60s, treat unhealthy

// ========= AWS CLIENTS =========
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const asg = new AutoScalingClient({ region: REGION });

// ========= HELPERS =========
const now = () => Date.now();

async function scaleOutByOneIfNeeded() {
  const resp = await asg.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [ASG_NAME] })
  );

  const group = resp.AutoScalingGroups?.[0];
  if (!group) throw new Error(`ASG not found: ${ASG_NAME}`);

  const desired = group.DesiredCapacity ?? 0;
  const max = group.MaxSize ?? desired;

  if (desired >= max) {
    return { scaled: false, reason: "ASG at max capacity", desired, max };
  }

  await asg.send(
    new SetDesiredCapacityCommand({
      AutoScalingGroupName: ASG_NAME,
      DesiredCapacity: desired + 1,
      HonorCooldown: false,
    })
  );

  return { scaled: true, desiredBefore: desired, desiredAfter: desired + 1 };
}

// ========= ROUTES =========

// 1) Instance registers itself
app.post("/register", async (req, res) => {
  try {
    const { instanceId, publicIp, privateIp } = req.body;

    if (!instanceId) return res.status(400).json({ error: "instanceId is required" });

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          instanceId,
          publicIp: publicIp || null,
          privateIp: privateIp || null,
          status: "available",
          lastHeartbeat: now(),
          userId: null,
          leaseExpiry: null,
        },
      })
    );

    return res.json({ ok: true, message: "registered", instanceId });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// 2) Heartbeat
app.post("/heartbeat", async (req, res) => {
  try {
    const { instanceId } = req.body;
    if (!instanceId) return res.status(400).json({ error: "instanceId is required" });

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { instanceId },
        UpdateExpression: "SET lastHeartbeat = :t",
        ExpressionAttributeValues: {
          ":t": now(),
        },
      })
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("HEARTBEAT ERROR:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// 3) Claim a machine
app.post("/claim", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Find available machines (MVP uses Scan - ok for small scale)
    const scanResp = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#s = :available",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    );

    const items = scanResp.Items || [];

    // Filter out stale machines (no heartbeat recently)
    const healthy = items.filter((m) => (now() - (m.lastHeartbeat || 0)) <= HEARTBEAT_MAX_AGE_MS);

    if (healthy.length === 0) {
      // No machines → scale out
      const scaleInfo = await scaleOutByOneIfNeeded();
      return res.status(202).json({
        ok: false,
        message: "No machines available. Scaling up. Retry in a few seconds.",
        scaleInfo,
      });
    }

    // Pick first machine (simple)
    const chosen : any = healthy[0];

    // Mark as leased
    const expiry = now() + LEASE_TTL_MS;

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { instanceId: chosen.instanceId },
        UpdateExpression: "SET #s = :leased, userId = :u, leaseExpiry = :e",
        ConditionExpression: "#s = :available", // avoid double-claim
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":leased": "leased",
          ":available": "available",
          ":u": userId,
          ":e": expiry,
        },
      })
    );

    return res.json({
      ok: true,
      instanceId: chosen.instanceId,
      publicIp: chosen.publicIp,
      privateIp: chosen.privateIp,
      leaseExpiry: expiry,
      connectionHint: chosen.publicIp
        ? `http://${chosen.publicIp}:8080`
        : "No public IP. Use SSM in next version.",
    });
  } catch (err) {
    console.error("CLAIM ERROR:", err);

    // If ConditionExpression failed (already claimed)
    // @ts-ignore
    if (String(err?.name).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Machine already claimed. Retry." });
    }

    return res.status(500).json({ error: "internal_error" });
  }
});

// 4) Release a machine
app.post("/release", async (req, res) => {
  try {
    const { instanceId } = req.body;
    if (!instanceId) return res.status(400).json({ error: "instanceId is required" });

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { instanceId },
        UpdateExpression: "SET #s = :available, userId = :null, leaseExpiry = :null",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":available": "available",
          ":null": null,
        },
      })
    );

    return res.json({ ok: true, message: "released", instanceId });
  } catch (err) {
    console.error("RELEASE ERROR:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "machine-claimer-backend" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
