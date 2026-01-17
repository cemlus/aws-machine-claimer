// this code file shows how the worker instances work
// testing ci/cd pipeline
import http from "http";

const BACKEND_URL = process.env.BACKEND_URL; 
if (!BACKEND_URL) {
  console.error("BACKEND_URL env missing");
  process.exit(1);
}

const sleep = (ms: any) => new Promise((r) => setTimeout(r, ms));

function httpGet(url: string) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

function httpPost(url: string, body: any) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

//  (IMDSv1 is used here for simplicity)
async function getMetadata(path: string) {
  const url = `http://169.254.169.254/latest/meta-data/${path}`;
  const res: any = await httpGet(url);
  return res.data.trim();
}

async function main() {
  while (true) {
    try {
      const instanceId = await getMetadata("instance-id");
      const privateIp = await getMetadata("local-ipv4");

      let publicIp = null;
      try {
        publicIp = await getMetadata("public-ipv4");
      } catch {}

      await httpPost(`${BACKEND_URL}/register`, {
        instanceId,
        privateIp,
        publicIp,
      });

      console.log("Registered:", instanceId);

      while (true) {
        await httpPost(`${BACKEND_URL}/heartbeat`, { instanceId });
        await sleep(15000);
      }
    } catch (e: any) {
      console.error("Agent error:", e.message);
      await sleep(5000);
    }
  }
}

main();
