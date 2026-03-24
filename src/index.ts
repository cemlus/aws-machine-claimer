import express from "express";
import cors from "cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AutoScalingClient, DescribeAutoScalingGroupsCommand, SetDesiredCapacityCommand } from "@aws-sdk/client-auto-scaling";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Allow frontend dev servers on common ports
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use(express.json());

// ========= CONFIG =========
const REGION = process.env.AWS_REGION || "ap-south-1";
const TABLE_NAME = process.env.TABLE_NAME || "machine_pool";
const ASG_NAME = process.env.ASG_NAME || "on-demand-machine-asg";

const LEASE_TTL_MS = 10 * 60 * 1000; // 10 min
const HEARTBEAT_MAX_AGE_MS = 60 * 1000; // if no heartbeat in 60s, treat unhealthy

// cooldown and scaling config
const TARGET_AVAILABLE = Number(process.env.TARGET_AVAILABLE || 2);
const SCALE_COOLDOWN_MS = 30 * 1000; // 30 seconds
let lastScaleOutAt = 0;


// ========= AWS CLIENTS =========
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const asg = new AutoScalingClient({ region: REGION });

// ========= HELPERS =========
const now = () => Date.now();

async function countAvailableWorkers() {
  const scanResp = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#s = :available",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":available": "available" },
    })
  );

  const items = scanResp.Items || [];
  const healthy = items.filter((m) => (now() - (m.lastHeartbeat || 0)) <= HEARTBEAT_MAX_AGE_MS);

  return healthy.length;
}

async function getAllMachines() {
  const scanResp = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return scanResp.Items || [];
}

async function scaleToMeetBuffer() {
  const t = now();

  // check cooldown
  if (t < lastScaleOutAt + SCALE_COOLDOWN_MS) {
    return {
      scaled: false,
      reason: "cooldown_active",
      retryAfterMs: SCALE_COOLDOWN_MS - (t - lastScaleOutAt),
    };
  }

  const availableNow = await countAvailableWorkers();

  // how many free machines do we want?
  const missing = TARGET_AVAILABLE - availableNow;

  if (missing <= 0) {
    return {
      scaled: false,
      reason: "buffer_satisfied",
      availableNow,
      targetAvailable: TARGET_AVAILABLE,
    };
  }

  // Get ASG details - handle missing ASG gracefully
  let group;
  try {
    const resp = await asg.send(
      new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [ASG_NAME] })
    );
    group = resp.AutoScalingGroups?.[0];
  } catch (err: any) {
    const code = err?.$metadata?.httpStatusCode;
    const name = err?.name;
    if (name === "ResourceNotFoundException" || code === 404) {
      throw new Error(
        `Auto Scaling Group '${ASG_NAME}' not found. ` +
        `Please create the ASG in AWS Console or set ASG_NAME to an existing ASG.`
      );
    }
    // Re-throw other AWS errors
    throw new Error(`AWS AutoScaling error: ${err?.message || err}`);
  }

  if (!group) {
    throw new Error(`ASG '${ASG_NAME}' not found. Please create the ASG or check ASG_NAME.`);
  }

  const desired = group.DesiredCapacity ?? 0;     // current number of instances available
  const max = group.MaxSize ?? desired;

  const desiredAfter = Math.min(desired + missing, max);
  if (desiredAfter === desired) {
    return {
      scaled: false,
      reason: "ASG at max capacity",
      desired,
      max,
      missing,
      availableNow,
      targetAvailable: TARGET_AVAILABLE,
    };
  }

  try {
    await asg.send(
      new SetDesiredCapacityCommand({
        AutoScalingGroupName: ASG_NAME,
        DesiredCapacity: desiredAfter,
        HonorCooldown: false,
      })
    );
  } catch (err: any) {
    throw new Error(`Failed to scale ASG: ${err?.message || err}`);
  }

  lastScaleOutAt = t;

  return {
    scaled: true,
    reason: "scaled_to_meet_buffer",
    availableNow,
    targetAvailable: TARGET_AVAILABLE,
    missing,
    desiredBefore: desired,
    desiredAfter,
  };
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
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Registration failed", error: "register_failed" });
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
  } catch (err: any) {
    console.error("HEARTBEAT ERROR:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Heartbeat failed", error: "heartbeat_failed" });
  }
});

// 3) Claim a machine
app.post("/claim", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Find available machines (with recent heartbeat)
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
      const scaleInfo = await scaleToMeetBuffer();
      return res.status(202).json({
        ok: false,
        message: "No machines available. Scaling up. Retry in a few seconds.",
        scaleInfo,
      });
    }

    // Pick first machine (simple)
    const chosen: any = healthy[0];

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
  } catch (err: any) {
    console.error("CLAIM ERROR:", err);

    // If ConditionExpression failed (already claimed)
    // @ts-ignore
    if (String(err?.name).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Machine already claimed. Retry." });
    }

    const message = err?.message || "Failed to claim machine";
    return res.status(500).json({ ok: false, message, error: "claim_failed" });
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
  } catch (err: any) {
    console.error("RELEASE ERROR:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Release failed", error: "release_failed" });
  }
});

// 5) Get fleet status
app.get("/status", async (req, res) => {
  try {
    const machines = await getAllMachines();
    const nowTime = now();
    const total = machines.length;
    const leased = machines.filter((m) => m.status === "leased").length;
    const available = machines.filter((m) => {
      if (m.status !== "available") return false;
      if ((m.lastHeartbeat || 0) <= nowTime - HEARTBEAT_MAX_AGE_MS) return false;
      return true;
    }).length;

    return res.json({
      total,
      available,
      leased,
      machines: machines.map((m) => ({
        instanceId: m.instanceId,
        status: m.status,
        publicIp: m.publicIp,
        privateIp: m.privateIp,
        lastHeartbeat: m.lastHeartbeat,
        userId: m.userId,
        leaseExpiry: m.leaseExpiry,
      })),
    });
  } catch (err: any) {
    console.error("STATUS ERROR:", err);
    const message = err?.message || "Failed to fetch status";
    return res.status(500).json({ error: "internal_error", message });
  }
});

// 6) Renew lease
app.post("/renew", async (req, res) => {
  try {
    const { instanceId } = req.body;
    if (!instanceId) return res.status(400).json({ error: "instanceId is required" });

    const newExpiry = now() + LEASE_TTL_MS;
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { instanceId },
        UpdateExpression: "SET leaseExpiry = :e",
        ConditionExpression: "#s = :leased",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":e": newExpiry,
          ":leased": "leased",
        },
      })
    );

    return res.json({ ok: true, leaseExpiry: newExpiry });
  } catch (err: any) {
    console.error("RENEW ERROR:", err);
    // @ts-ignore
    if (String(err?.name).includes("ConditionalCheckFailed")) {
      return res.status(409).json({ ok: false, message: "Machine not leased or not found" });
    }
    return res.status(500).json({ ok: false, message: err?.message || "Renewal failed", error: "renew_failed" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "machine-claimer-backend" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
