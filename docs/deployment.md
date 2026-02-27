# Deployment Guide (Production)

This project uses:
- Frontend (`apps/web`) on GitHub Pages
- API (`apps/api`) on Zeabur
- Self-hosted Convex (backend + dashboard) on Zeabur

## 1. Zeabur template (multi-service)

This repo now includes a multi-service template:
- `zeabur.yml`

It deploys 3 services into one Zeabur project:
- `API` (Git source from this repo)
- `Convex Backend` (official prebuilt image)
- `Convex Dashboard` (official prebuilt image)

Dockerfile selection for API:
- `Dockerfile.API` (service-name matched Dockerfile)
- `ZBPACK_DOCKERFILE_NAME=API`

`zeabur.yml` is intended to work with:
- Zeabur CLI (`template deploy`)
- Zeabur review-app automation that consumes template YAML

## 2. Deploy with Zeabur CLI

Official CLI repo:
- [zeabur/cli](https://github.com/zeabur/cli)

Local command flow:

```bash
npx -y zeabur@latest auth login --token <ZEABUR_TOKEN>

npx -y zeabur@latest template deploy \
  -i=false \
  --file zeabur.yml \
  --project-id <ZEABUR_PROJECT_ID> \
  --var BACKEND_DOMAIN=<convex-backend-subdomain> \
  --var CONVEX_INSTANCE_SECRET=<hex-secret>
```

Generate Convex instance secret:

```bash
openssl rand -hex 32
```

Notes:
- `BACKEND_DOMAIN` is the Zeabur-generated subdomain (without `.zeabur.app`).
- `CONVEX_INSTANCE_SECRET` must be hex. Non-hex values will crash Convex backend on startup.
- Template currently pins GitHub repo id for `Yukaii/inko`. If you fork/rename repo, update `spec.services[API].spec.source.repo` in `zeabur.yml`.

## 3. GitHub Action for CLI deploy

Workflow file:
- `.github/workflows/deploy-zeabur-template.yml`

Required GitHub secrets:
- `ZEABUR_TOKEN`
- `ZEABUR_PROJECT_ID`
- `ZEABUR_BACKEND_DOMAIN`
- `ZEABUR_CONVEX_INSTANCE_SECRET` (output of `openssl rand -hex 32`)

This workflow is `workflow_dispatch` (manual trigger) to avoid accidental production redeploys.

## 4. Self-hosted Convex runtime notes

Convex backend service requirements:
- persistent volume mounted to `/convex/data`
- secure hex `INSTANCE_SECRET` value

If backend logs show `Couldn't hexdecode key`, fix by replacing `INSTANCE_SECRET` with a valid hex secret and redeploying/restarting the service.

After first boot, generate admin key in Convex backend service terminal:

```bash
./generate_admin_key.sh
```

`CONVEX_URL` for API should point to Convex backend public URL:
- `https://<BACKEND_DOMAIN>.zeabur.app`

## 5. Frontend on GitHub Pages

Workflow file:
- `.github/workflows/deploy-frontend-pages.yml`

Required GitHub repository secret:
- `VITE_API_URL=https://<your-zeabur-api-domain>`

Notes:
- Workflow builds Vite with repo base path: `/<repo-name>/`
- Workflow copies `index.html` to `404.html` for SPA fallback on GitHub Pages

## 6. CI checks

Workflow file:
- `.github/workflows/ci.yml`

Runs on PRs and pushes to `main`:
- install
- lint
- test
- build

## 7. Recommended production checklist

- `zeabur.yml` deployed successfully (3 services created)
- Convex backend volume mounted at `/convex/data`
- API `JWT_SECRET` replaced with strong value
- Convex `INSTANCE_SECRET` is valid hex
- API `FRONTEND_URL` matches GitHub Pages domain
- `VITE_API_URL` points to API domain
- CORS requests from GitHub Pages domain succeed
- API `/health` returns `{"ok": true}`
