# One-line project summary

Built an orchestrator service + Auto Scaling Group that serves on-demand Ubuntu VMs (code-server) to users: backend assigns a free VM, triggers ASG scale-out when needed, and reclaims VMs when sessions expire.

# High-level architecture you implemented

- Orchestrator (backend) — Node.js + Express running on an EC2 instance (PM2 for process management). Talks to DynamoDB and AutoScaling API.
- Worker VMs — Ubuntu 22.04 AMI with code-server + a custom agent (registers + heartbeats to the backend and exposes a local health check).
- Auto Scaling Group (ASG) — Launches workers from a Launch Template that uses your AMI and user-data.
- Datastore — DynamoDB table worker_pool to track instance state: instanceId, status, publicIp, privateIp, lastHeartbeat, leaseExpiry, userId.
- Connection — MVP returns worker public IP & code-server URL (later can use SSM for secure access).

# Specific technical things you built & configured

## Node.js backend with routes:

- POST /register — worker → orchestrator (register metadata)
- POST /heartbeat — periodic keep-alive
- POST /claim — client requests a VM
- POST /release — client/agent frees a VM
- GET /health — orchestrator health check

## Worker agent.js (Node):

- reads EC2 metadata (IMDS)
- calls /register on boot and sends /heartbeat every 15s
- installed as a systemd service worker-agent

Created an AMI from a configured worker and built a Launch Template and Auto Scaling Group from it.

## IAM roles:

- EC2 role for orchestrator with DynamoDB & AutoScaling permissions (attached to the orchestrator EC2 — avoided storing long-lived AWS keys).

## Security Groups:

- orchestrator SG allowing port 3000 from worker SG (internal), and 3000 SSH from dev IP for testing
- worker SG allowing SSH and code-server ports from your IP (MVP)

Process manager: pm2 to keep orchestrator running and survive reboots.

## Implemented operational protections:

- Cooldown (30s) to avoid repeated immediate scale calls.
- Missing-machines scaling: compute missing = TARGET_AVAILABLE - available and scale by missing rather than +1 on every request.

## Manual testing flow:

- Triggered /claim, observed DynamoDB updates, and verified ASG DesiredCapacity changes and instance boots.

## Debugging skills used:

- Reading ASG activity logs to spot EC2 vCPU quota issues
- Inspecting systemd journal logs on worker for worker-agent
- Querying /health endpoints and DynamoDB to confirm flow

# Key concepts you learned (and why they matter)

- Auto Scaling Groups & Launch Templates — how to create reusable VM templates and let ASG manage fleet size.
- AMI baking vs user-data — when to bake apps/agent into AMI and when to use user-data to inject per-instance config (backend URL, dynamic password).
- Instance Metadata Service (IMDS/IMDSv2) — how agents discover instanceId and IP from within EC2.
- Lifecycle hooks & scale-in protection (conceptual) — why you prevent ASG from terminating leased instances.
- DynamoDB basics — schema-less table design, scanning vs GSIs, and using it as lease registry.
- IAM roles for EC2 — why instance profiles are safer than embedding AWS keys.
- Security groups & VPC network rules — backend ← worker connectivity and least-privilege networking.
- Cloud quotas & limits (vCPU quota) — how quotas can silently block scale operations; reading ASG activity for failure reasons.

## Scaling strategies:

- naive +1 scaling (reactive, can overshoot)
- buffer/missing-machines scaling (targeted, fewer API calls, faster recovery)

Operational resilience — PM2, systemd, logs, health checks, TTL cleanup ideas.

# Commands & files you created (useful checklist)

## Backend repo:

index.js (Express + AWS SDK v3), used envs: AWS_REGION, TABLE_NAME, ASG_NAME, TARGET_AVAILABLE, PORT.

## Worker agent:

/home/ubuntu/agent.js and systemd unit /etc/systemd/system/worker-agent.service.

## PM2 commands:

- pm2 start index.js --name orchestrator
- pm2 save
- pm2 startup (to persist on reboot)

## DynamoDB:

created table worker_pool with instanceId partition key.

## Useful debug commands:

- sudo journalctl -u worker-agent -n 50 --no-pager
- curl http://<ORCH_PRIVATE_IP>:3000/health
- aws dynamodb list-tables --region <region>
- EC2 Console → Auto Scaling Group → Activity logs

# Practical lessons & gotchas (what bit you and how you fixed it)

- IMDS v2 requirement made agent's IMDSv1 calls fail — either enable IMDSv1 temporarily or update agent to IMDSv2.
- New instances didn't appear because ASG hit your vCPU quota — read ASG activity logs for these errors and either change instance type / max size or request quota increase.
- Security group misconfiguration prevented worker → orchestrator communication; ensure orchestrator SG allows inbound from worker SG on port 3000.
- Using DynamoDB Scan is OK for MVP but not scalable — later add GSI on status or maintain a counter item for available capacity.
- Avoid giving users AWS keys — use instance profile (IAM role) for EC2 SDK calls.
