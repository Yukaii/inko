# Deployment Guide (Production)

This project uses:
- Frontend (`apps/web`) on Zeabur or GitHub Pages
- API (`apps/api`) on Zeabur
- PostgreSQL on Zeabur
- Cloudflare R2 for object storage

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
OBJECT_STORAGE_ENDPOINT="https://<r2-account-id>.r2.cloudflarestorage.com"
OBJECT_STORAGE_ACCESS_KEY_ID="<r2-access-key-id>"
OBJECT_STORAGE_SECRET_ACCESS_KEY="<r2-secret-access-key>"
OBJECT_STORAGE_BUCKET="inko-media"

npx -y zeabur@latest auth login --token <ZEABUR_TOKEN>

npx -y zeabur@latest template deploy \
  -i=false \
  --file zeabur.yml \
  --project-id <ZEABUR_PROJECT_ID> \
  --var API_DOMAIN=<api-subdomain> \
  --var FRONTEND_DOMAIN=<frontend-subdomain> \
  --var OBJECT_STORAGE_ENDPOINT=<r2-endpoint> \
  --var OBJECT_STORAGE_ACCESS_KEY_ID=<r2-access-key-id> \
  --var OBJECT_STORAGE_SECRET_ACCESS_KEY=<r2-secret-access-key> \
  --var OBJECT_STORAGE_BUCKET=<r2-bucket>
```

Notes:
- `API_DOMAIN` and `FRONTEND_DOMAIN` are Zeabur-generated subdomains (without `.zeabur.app`).
- Template currently pins GitHub repo id for `Yukaii/inko`. If you fork/rename repo, update `spec.services[API].spec.source.repo` in `zeabur.yml`.
- API reads `DATABASE_URL` from Zeabur's `${POSTGRES_CONNECTION_STRING}` exposed variable.
- API reads object storage from `${OBJECT_STORAGE_ENDPOINT}` (Cloudflare R2 S3 endpoint).
- Set `OBJECT_STORAGE_REGION=auto` for R2.
- Set `OBJECT_STORAGE_FORCE_PATH_STYLE=false` for R2 (template default).

## 2.2 Deploy only selected services

If you only want to redeploy part of the stack, use:

- [scripts/zeabur-deploy-template.sh](/Users/yukai/Projects/Personal/inko/scripts/zeabur-deploy-template.sh)

The wrapper trims unselected services from `zeabur.yml`, removes dependencies that are no longer present, keeps only the template variables still needed by the selected services, and then calls `zeabur template deploy`.

Examples:

```bash
export ZEABUR_TOKEN=<your-token>
export ZEABUR_PROJECT_ID=<your-project-id>
export ZEABUR_API_DOMAIN=<api-subdomain>
export ZEABUR_FRONTEND_DOMAIN=<frontend-subdomain>
export ZEABUR_OBJECT_STORAGE_ENDPOINT=<r2-endpoint>
export ZEABUR_OBJECT_STORAGE_ACCESS_KEY_ID=<r2-access-key-id>
export ZEABUR_OBJECT_STORAGE_SECRET_ACCESS_KEY=<r2-secret-access-key>
export ZEABUR_OBJECT_STORAGE_BUCKET=<r2-bucket>
```

Deploy only the API service:

```bash
scripts/zeabur-deploy-template.sh --services API --skip-validation
```

Choose services interactively with `fzf`:

```bash
scripts/zeabur-deploy-template.sh --fzf --skip-validation
```

Load template variables from a dotenv file:

```bash
scripts/zeabur-deploy-template.sh --services API --env-file .env.zeabur --skip-validation
```

Deploy only PostgreSQL:

```bash
scripts/zeabur-deploy-template.sh --services PostgreSQL --skip-validation
```

Deploy API and Frontend together:

```bash
scripts/zeabur-deploy-template.sh --services API,Frontend --skip-validation
```

Preview the filtered template without deploying:

```bash
scripts/zeabur-deploy-template.sh --services API,PostgreSQL --dry-run
```

Preview after picking services interactively:

```bash
scripts/zeabur-deploy-template.sh --fzf --dry-run
```

Variable resolution order:

1. `--var KEY=value`
2. shell env `KEY=value`
3. shell env `ZEABUR_KEY=value`
4. `--env-file` entries `KEY=value`
5. `--env-file` entries `ZEABUR_KEY=value`

So `ZEABUR_API_DOMAIN` satisfies `API_DOMAIN`, `ZEABUR_OBJECT_STORAGE_BUCKET` satisfies `OBJECT_STORAGE_BUCKET`, and so on.

The env file is parsed as a simple dotenv-style file. Blank lines, `# comments`, and optional leading `export ` are supported.

## 2.1 R2 credentials

Use these exact formats:

- `OBJECT_STORAGE_ENDPOINT`: `https://<accountid>.r2.cloudflarestorage.com`
- `OBJECT_STORAGE_ACCESS_KEY_ID`: R2 API token access key ID
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`: R2 API token secret access key
- `OBJECT_STORAGE_BUCKET`: existing R2 bucket name such as `inko-media`

R2 endpoint rule:
- Use the account-level endpoint only, without bucket path and without bucket subdomain.
- Correct: `https://<accountid>.r2.cloudflarestorage.com`
- Wrong: `https://<bucket>.<accountid>.r2.cloudflarestorage.com`
- Wrong: `https://<accountid>.r2.cloudflarestorage.com/<bucket>`

## 3. GitHub Action for CLI deploy

Workflow file:
- `.github/workflows/deploy-zeabur-template.yml`

Required GitHub secrets:
- `ZEABUR_TOKEN`
- `ZEABUR_PROJECT_ID`
- `ZEABUR_API_DOMAIN`
- `ZEABUR_FRONTEND_DOMAIN`
- `ZEABUR_OBJECT_STORAGE_ENDPOINT`
- `ZEABUR_OBJECT_STORAGE_ACCESS_KEY_ID`
- `ZEABUR_OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `ZEABUR_OBJECT_STORAGE_BUCKET`

This workflow is `workflow_dispatch` (manual trigger) to avoid accidental production redeploys.

## 4. PostgreSQL runtime notes

- PostgreSQL persists data at `/var/lib/postgresql/data`
- API gets its connection string from `${POSTGRES_CONNECTION_STRING}`
- Zeabur generates the PostgreSQL username and password for the service when they are not pinned in the template
- API runs Kysely migrations on boot, so a fresh project should initialize its schema automatically
- If you rotate credentials in the PostgreSQL service later, redeploy the API service so `DATABASE_URL` stays in sync with the new `${POSTGRES_CONNECTION_STRING}`

## 5. R2 runtime notes

- API talks to R2 through `${OBJECT_STORAGE_ENDPOINT}` with S3-compatible auth.
- Use `OBJECT_STORAGE_REGION=auto`.
- Bucket and key credentials are managed in Cloudflare, not in Zeabur runtime.

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

- `zeabur.yml` deployed successfully (3 services created)
- PostgreSQL volume mounted at `/var/lib/postgresql/data`
- API `JWT_SECRET` replaced with strong value
- API `MAIL_PROVIDER` set to `resend`
- API `RESEND_API_KEY` configured
- API `MAIL_FROM` configured with verified sender domain
- API `FRONTEND_URL` matches frontend domain
- API `API_PUBLIC_URL` matches API domain
- OAuth provider envs configured when GitHub or Google login is enabled
- API object storage envs point at R2 endpoint and valid bucket/key
- frontend `VITE_API_URL` points to API domain
- CORS requests from frontend domain succeed
- API `/health` returns `{"ok": true}`
