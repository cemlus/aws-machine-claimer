# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Tasks

**Backend (Node.js + Express + TypeScript)**
- Build: `npm run build` (compiles TypeScript to dist/)
- Run: `npm start` or `node dist/index.js`
- Dev: `npm run dev` (builds then runs)
- Type checking: `npx tsc --noEmit`

**Frontend (Vite + React + TypeScript)**
- Dev server: `cd frontend && npm run dev` (http://localhost:5173)
- Build: `cd frontend && npm run build`
- Type checking: `cd frontend && npx tsc --noEmit`

**CORS Note:** Backend allows requests from `http://localhost:5173`. If you change frontend port, update CORS in `src/index.ts`.

## Code Architecture

This is an **AWS Machine Claimer** system with two parts:

**Backend** (`src/index.ts`, dist/)
- Express REST API that orchestrates EC2 worker VMs
- Routes:
  - POST `/register` - worker registers with instance metadata
  - POST `/heartbeat` - periodic keep-alive from workers
  - POST `/claim` - client requests an available VM, triggers scaling if none free
  - POST `/release` - returns VM to pool
  - POST `/renew` - extends lease by 10 minutes
  - GET `/status` - returns fleet overview (total, available, leased, machines array)
  - GET `/health` - health check
- Uses DynamoDB table `machine_pool` (configurable via TABLE_NAME) to track instances
- Uses Auto Scaling Group (ASG) to manage worker fleet size
- Buffer-based scaling: tries to maintain TARGET_AVAILABLE free machines (default 2)
- Configuration via environment: AWS_REGION, TABLE_NAME, ASG_NAME, TARGET_AVAILABLE, PORT

**Worker Agent** (`src/worker.ts`)
- Runs on each EC2 worker instance
- Fetches metadata from EC2 Instance Metadata Service (IMDSv1)
- Registers itself to orchestrator and sends heartbeat every 15 seconds
- Intended to be installed as systemd service (not run via npm)

**Frontend** (`frontend/`)
- Vite + React + TypeScript SPA
- Components: FleetStatus, MachineList, ClaimedMachine, ClaimForm
- API client in `src/api.ts` using axios
- Tailwind CSS for styling
- Auto-refreshes status every 10 seconds
- Shows available machines, allows claiming with userId, displaying connection details (code-server URL, SSH command), releasing, and renewing leases

## Data Model (DynamoDB)
- Partition key: `instanceId` (string)
- Attributes: `status` (available/leased), `publicIp`, `privateIp`, `lastHeartbeat`, `userId`, `leaseExpiry`

## Important Notes
- Backend currently requires AWS credentials via environment (IAM role on EC2 or AWS config on local)
- The system is designed for single-user scenario; no authentication on API endpoints
- Workers must be able to reach orchestrator on port 3000 (security group configuration)
- Frontend defaults to `http://localhost:3000`; override with `VITE_API_URL` if backend is hosted elsewhere