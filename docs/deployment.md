# Deployment Guide (Production)

This project uses:
- Frontend (`apps/web`) on GitHub Pages
- API (`apps/api`) on Zeabur
- Data/functions on self-hosted Convex (also on Zeabur)

## 1. Self-hosted Convex on Zeabur

This repo includes two Convex service Dockerfiles:

- `convex-backend.Dockerfile` (Convex backend, ports `3210` and `3211`)
- `convex-dashboard.Dockerfile` (Convex dashboard, port `6791`)

Create 2 Zeabur services from this repository:
- Service A: `convex-backend`
- Service B: `convex-dashboard`

Set each service to use the matching Dockerfile by name:
- backend service: `convex-backend.Dockerfile`
- dashboard service: `convex-dashboard.Dockerfile`

Backend service environment variables:
- `INSTANCE_NAME=inko-prod`
- `INSTANCE_SECRET=<strong random secret>`

Backend service storage:
- mount persistent volume to `/convex/data`

Dashboard service environment variables:
- `NEXT_PUBLIC_DEPLOYMENT_URL=https://<your-convex-backend-domain>`

Important:
- Keep Convex backend and dashboard in the same region.
- If Convex backend URL changes, update `NEXT_PUBLIC_DEPLOYMENT_URL` in dashboard and `CONVEX_URL` in API service.
- Self-hosted Convex admin key setup is required after first boot. In the backend service terminal, run:

```bash
./generate_admin_key.sh
```

## 2. Zeabur backend deployment (`apps/api`)

This repo includes:
- `Dockerfile` (root): builds and runs the API with Bun
- `zbpack.json`: explicit build/start commands for Zeabur

Required environment variables in Zeabur:
- `PORT=4000` (or Zeabur-provided port)
- `CONVEX_URL=https://<your-convex-backend-domain>`
- `JWT_SECRET=<strong random secret, min 16 chars>`
- `FRONTEND_URL=<your github pages url>`

Health check endpoint:
- `GET /health`

## 3. GitHub Pages frontend deployment (`apps/web`)

Workflow file:
- `.github/workflows/deploy-frontend-pages.yml`

Required GitHub repository secret:
- `VITE_API_URL=https://<your-zeabur-backend-domain>`

Notes:
- Workflow builds Vite with repo base path: `/<repo-name>/`
- Workflow copies `index.html` to `404.html` for SPA fallback on GitHub Pages

## 4. CI checks

Workflow file:
- `.github/workflows/ci.yml`

Runs on PRs and pushes to `main`:
- install
- lint
- test
- build

## 5. Recommended production checklist

- Convex backend + dashboard running on Zeabur
- Convex backend has persistent volume at `/convex/data`
- Zeabur API env vars configured correctly
- `FRONTEND_URL` and `VITE_API_URL` point to each other correctly
- CORS requests from GitHub Pages domain succeed
- `/health` returns `{"ok": true}` after deploy
