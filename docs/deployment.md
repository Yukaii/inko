# Deployment Guide (Production)

This project uses:
- Frontend (`apps/web`) on Zeabur or GitHub Pages
- API (`apps/api`) on Zeabur
- PostgreSQL on Zeabur
- Garage object storage on Zeabur

## 1. Zeabur template (multi-service)

This repo now includes a multi-service template:
- `zeabur.yml`

It deploys 4 services into one Zeabur project:
- `API` (Git source from this repo)
- `PostgreSQL` (official `postgres:16-alpine` image)
- `Garage` (Git source from this repo via `Dockerfile.garage`)
- `Frontend` (Git source from `apps/web`)

Dockerfile selection for API:
- `Dockerfile.api`
- `ZBPACK_DOCKERFILE_NAME=api`

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
  --var API_DOMAIN=<api-subdomain> \
  --var FRONTEND_DOMAIN=<frontend-subdomain> \
  --var GARAGE_DOMAIN=<garage-subdomain> \
  --var GARAGE_RPC_SECRET=<garage-rpc-secret> \
  --var GARAGE_ADMIN_TOKEN=<garage-admin-token> \
  --var OBJECT_STORAGE_ACCESS_KEY_ID=<garage-key-id> \
  --var OBJECT_STORAGE_SECRET_ACCESS_KEY=<garage-secret> \
  --var OBJECT_STORAGE_BUCKET=inko-media
```

Notes:
- `API_DOMAIN` and `FRONTEND_DOMAIN` are Zeabur-generated subdomains (without `.zeabur.app`).
- `GARAGE_DOMAIN` is the public S3 endpoint domain for Garage.
- Template currently pins GitHub repo id for `Yukaii/inko`. If you fork/rename repo, update `spec.services[API].spec.source.repo` in `zeabur.yml`.
- API reads `DATABASE_URL` from Zeabur's `${POSTGRES_CONNECTION_STRING}` exposed variable.
- API reads object storage from the Garage S3-compatible endpoint.
- `GARAGE_RPC_SECRET` must be a valid 64-character hexadecimal string.

## 3. GitHub Action for CLI deploy

Workflow file:
- `.github/workflows/deploy-zeabur-template.yml`

Required GitHub secrets:
- `ZEABUR_TOKEN`
- `ZEABUR_PROJECT_ID`
- `ZEABUR_API_DOMAIN`
- `ZEABUR_FRONTEND_DOMAIN`
- `ZEABUR_GARAGE_DOMAIN`
- `ZEABUR_GARAGE_RPC_SECRET`
- `ZEABUR_GARAGE_ADMIN_TOKEN`
- `ZEABUR_OBJECT_STORAGE_ACCESS_KEY_ID`
- `ZEABUR_OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `ZEABUR_OBJECT_STORAGE_BUCKET`

This workflow is `workflow_dispatch` (manual trigger) to avoid accidental production redeploys.

## 4. PostgreSQL runtime notes

- PostgreSQL persists data at `/var/lib/postgresql/data`
- API gets its connection string from `${POSTGRES_CONNECTION_STRING}`
- API runs Kysely migrations on boot, so a fresh project should initialize its schema automatically
- If you want a non-default database password, change `POSTGRES_PASSWORD` in the `PostgreSQL` service after deploy and redeploy the API service so `DATABASE_URL` stays in sync

## 5. Garage runtime notes

- Garage stores metadata at `/var/lib/garage/meta` and objects at `/var/lib/garage/data`
- API talks to Garage through the S3-compatible endpoint at `https://<GARAGE_DOMAIN>.zeabur.app`
- Garage now auto-bootstraps its single-node layout, imports the application key, and ensures the configured bucket exists on startup
- Set these template variables before deploy:
  - `OBJECT_STORAGE_ACCESS_KEY_ID`
  - `OBJECT_STORAGE_SECRET_ACCESS_KEY`
  - `OBJECT_STORAGE_BUCKET`
- Reusing the same access key ID and secret on redeploy is intentional; the bootstrap path is idempotent

## 6. Frontend on Zeabur (recommended when GitHub Actions quota is limited)

The template deploys `Frontend` from `apps/web` and sets:
- `VITE_API_URL=https://${API_DOMAIN}.zeabur.app`
- `VITE_SITE_URL=https://${FRONTEND_DOMAIN}.zeabur.app`

After deploy, use:
- `https://<FRONTEND_DOMAIN>.zeabur.app`

## 7. Frontend on GitHub Pages (optional alternative)

Workflow file:
- `.github/workflows/deploy-frontend-pages.yml`

Required GitHub repository secret:
- `VITE_API_URL=https://<your-zeabur-api-domain>`
- `VITE_SITE_URL=https://<your-frontend-domain>`

Notes:
- Workflow builds Vite with repo base path: `/<repo-name>/`
- Workflow copies `index.html` to `404.html` for SPA fallback on GitHub Pages

## 8. CI checks

Workflow file:
- `.github/workflows/ci.yml`

Runs on PRs and pushes to `main`:
- install
- lint
- test
- build

## 9. Recommended production checklist

- `zeabur.yml` deployed successfully (4 services created)
- PostgreSQL volume mounted at `/var/lib/postgresql/data`
- Garage volumes mounted at `/var/lib/garage/meta` and `/var/lib/garage/data`
- API `JWT_SECRET` replaced with strong value
- API `MAIL_PROVIDER` set to `resend`
- API `RESEND_API_KEY` configured
- API `MAIL_FROM` configured with verified sender domain
- API `FRONTEND_URL` matches frontend domain
- API `API_PUBLIC_URL` matches API domain
- OAuth provider envs configured when GitHub or Google login is enabled
- API object storage envs point at Garage and valid bucket/key
- frontend `VITE_API_URL` points to API domain
- CORS requests from frontend domain succeed
- API `/health` returns `{"ok": true}`
