# Deployment Guide (Production)

This project uses:
- Frontend (`apps/web`) on Zeabur or GitHub Pages
- API (`apps/api`) on Zeabur
- PostgreSQL on Zeabur

## 1. Zeabur template (multi-service)

This repo now includes a multi-service template:
- `zeabur.yml`

It deploys 3 services into one Zeabur project:
- `API` (Git source from this repo)
- `PostgreSQL` (official `postgres:16-alpine` image)
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
  --var FRONTEND_DOMAIN=<frontend-subdomain>
```

Notes:
- `API_DOMAIN` and `FRONTEND_DOMAIN` are Zeabur-generated subdomains (without `.zeabur.app`).
- Template currently pins GitHub repo id for `Yukaii/inko`. If you fork/rename repo, update `spec.services[API].spec.source.repo` in `zeabur.yml`.
- API reads `DATABASE_URL` from Zeabur's `${POSTGRES_CONNECTION_STRING}` exposed variable.

## 3. GitHub Action for CLI deploy

Workflow file:
- `.github/workflows/deploy-zeabur-template.yml`

Required GitHub secrets:
- `ZEABUR_TOKEN`
- `ZEABUR_PROJECT_ID`
- `ZEABUR_API_DOMAIN`
- `ZEABUR_FRONTEND_DOMAIN`

This workflow is `workflow_dispatch` (manual trigger) to avoid accidental production redeploys.

## 4. PostgreSQL runtime notes

- PostgreSQL persists data at `/var/lib/postgresql/data`
- API gets its connection string from `${POSTGRES_CONNECTION_STRING}`
- API runs Kysely migrations on boot, so a fresh project should initialize its schema automatically
- If you want a non-default database password, change `POSTGRES_PASSWORD` in the `PostgreSQL` service after deploy and redeploy the API service so `DATABASE_URL` stays in sync

## 5. Frontend on Zeabur (recommended when GitHub Actions quota is limited)

The template deploys `Frontend` from `apps/web` and sets:
- `VITE_API_URL=https://${API_DOMAIN}.zeabur.app`
- `VITE_SITE_URL=https://${FRONTEND_DOMAIN}.zeabur.app`

After deploy, use:
- `https://<FRONTEND_DOMAIN>.zeabur.app`

## 6. Frontend on GitHub Pages (optional alternative)

Workflow file:
- `.github/workflows/deploy-frontend-pages.yml`

Required GitHub repository secret:
- `VITE_API_URL=https://<your-zeabur-api-domain>`
- `VITE_SITE_URL=https://<your-frontend-domain>`

Notes:
- Workflow builds Vite with repo base path: `/<repo-name>/`
- Workflow copies `index.html` to `404.html` for SPA fallback on GitHub Pages

## 7. CI checks

Workflow file:
- `.github/workflows/ci.yml`

Runs on PRs and pushes to `main`:
- install
- lint
- test
- build

## 8. Recommended production checklist

- `zeabur.yml` deployed successfully (3 services created)
- PostgreSQL volume mounted at `/var/lib/postgresql/data`
- API `JWT_SECRET` replaced with strong value
- API `MAIL_PROVIDER` set to `resend`
- API `RESEND_API_KEY` configured
- API `MAIL_FROM` configured with verified sender domain
- API `FRONTEND_URL` matches frontend domain
- frontend `VITE_API_URL` points to API domain
- CORS requests from frontend domain succeed
- API `/health` returns `{"ok": true}`
