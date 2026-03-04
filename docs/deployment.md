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
GARAGE_RPC_SECRET="$(openssl rand -hex 32)"
GARAGE_ADMIN_TOKEN="$(openssl rand -hex 32)"
OBJECT_STORAGE_ACCESS_KEY_ID="inkoapp$(openssl rand -hex 8)"
OBJECT_STORAGE_SECRET_ACCESS_KEY="$(openssl rand -hex 32)"

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
- API reads object storage from Garage's internal `${GARAGE_S3_ENDPOINT}` exposed variable.
- `GARAGE_RPC_SECRET` must be a valid 64-character hexadecimal string.

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
export ZEABUR_GARAGE_DOMAIN=<garage-subdomain>
export ZEABUR_GARAGE_RPC_SECRET=<64-hex-rpc-secret>
export ZEABUR_GARAGE_ADMIN_TOKEN=<admin-token>
export ZEABUR_OBJECT_STORAGE_ACCESS_KEY_ID=<access-key-id>
export ZEABUR_OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
export ZEABUR_OBJECT_STORAGE_BUCKET=inko-media
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
scripts/zeabur-deploy-template.sh --services Garage --env-file .env.zeabur --skip-validation
```

Deploy only Garage:

```bash
scripts/zeabur-deploy-template.sh --services Garage --skip-validation
```

Deploy API and Frontend together:

```bash
scripts/zeabur-deploy-template.sh --services API,Frontend --skip-validation
```

Preview the filtered template without deploying:

```bash
scripts/zeabur-deploy-template.sh --services API,Garage --dry-run
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

## 2.1 Garage secret formats

Use these exact formats:

- `GARAGE_RPC_SECRET`: exactly 64 lowercase hex characters
- `GARAGE_ADMIN_TOKEN`: any long random string; 64 lowercase hex characters is fine
- `OBJECT_STORAGE_ACCESS_KEY_ID`: plain ASCII string; 16 to 32 chars is a practical target
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`: long random string; 64 lowercase hex characters is fine
- `OBJECT_STORAGE_BUCKET`: DNS-safe bucket name such as `inko-media`

Copy-pasteable generation commands:

```bash
GARAGE_RPC_SECRET="$(openssl rand -hex 32)"
GARAGE_ADMIN_TOKEN="$(openssl rand -hex 32)"
OBJECT_STORAGE_ACCESS_KEY_ID="inkoapp$(openssl rand -hex 8)"
OBJECT_STORAGE_SECRET_ACCESS_KEY="$(openssl rand -hex 32)"
OBJECT_STORAGE_BUCKET="inko-media"

printf 'GARAGE_RPC_SECRET=%s\n' "$GARAGE_RPC_SECRET"
printf 'GARAGE_ADMIN_TOKEN=%s\n' "$GARAGE_ADMIN_TOKEN"
printf 'OBJECT_STORAGE_ACCESS_KEY_ID=%s\n' "$OBJECT_STORAGE_ACCESS_KEY_ID"
printf 'OBJECT_STORAGE_SECRET_ACCESS_KEY=%s\n' "$OBJECT_STORAGE_SECRET_ACCESS_KEY"
printf 'OBJECT_STORAGE_BUCKET=%s\n' "$OBJECT_STORAGE_BUCKET"
```

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
- Zeabur generates the PostgreSQL username and password for the service when they are not pinned in the template
- API runs Kysely migrations on boot, so a fresh project should initialize its schema automatically
- If you rotate credentials in the PostgreSQL service later, redeploy the API service so `DATABASE_URL` stays in sync with the new `${POSTGRES_CONNECTION_STRING}`

## 5. Garage runtime notes

- Garage stores metadata at `/var/lib/garage/meta` and objects at `/var/lib/garage/data`
- API talks to Garage through the internal S3-compatible endpoint `${GARAGE_S3_ENDPOINT}`
- `GARAGE_DOMAIN` remains the public/external Garage domain if you need outside access
- Garage now auto-bootstraps its single-node layout, imports the application key, and ensures the configured bucket exists on startup
- Set these template variables before deploy:
  - `OBJECT_STORAGE_ACCESS_KEY_ID`
  - `OBJECT_STORAGE_SECRET_ACCESS_KEY`
  - `OBJECT_STORAGE_BUCKET`
- Reusing the same access key ID and secret on redeploy is intentional; the bootstrap path is idempotent

Expected bootstrap behavior on a healthy first deploy:

- Garage starts on ports `3900`, `3901`, and `3903`
- `scripts/garage/run.sh` starts Garage and then runs `scripts/garage/bootstrap.sh`
- bootstrap waits for `/garage status` to succeed
- bootstrap runs:
  - `garage layout assign -z <zone> -c <capacity> <node-id>`
  - `garage layout apply --version 1`
  - `garage bucket create <bucket>`
  - `garage key import --yes -n inko-app <access-key-id> <secret>`
  - `garage bucket allow --read --write --owner <bucket> --key <access-key-id>`

If you need to re-run bootstrap manually from a Zeabur shell inside the `Garage` service, use:

```bash
/garage status
NODE_ID="$(/garage status | awk '/^[0-9a-f]{16}[[:space:]]/ { print $1; exit }')"
echo "$NODE_ID"

/garage layout assign -z "${GARAGE_BOOTSTRAP_ZONE:-garage}" -c "${GARAGE_BOOTSTRAP_CAPACITY:-10GB}" "$NODE_ID"
/garage layout apply --version 1
/garage bucket create "${OBJECT_STORAGE_BUCKET}"
/garage key import --yes -n inko-app "${OBJECT_STORAGE_ACCESS_KEY_ID}" "${OBJECT_STORAGE_SECRET_ACCESS_KEY}"
/garage bucket allow --read --write --owner "${OBJECT_STORAGE_BUCKET}" --key "${OBJECT_STORAGE_ACCESS_KEY_ID}"
```

To verify the result from that shell:

```bash
/garage bucket list
/garage key list
/garage key info "${OBJECT_STORAGE_ACCESS_KEY_ID}"
```

You should see:

- bucket `inko-media` or your chosen bucket name
- key matching `OBJECT_STORAGE_ACCESS_KEY_ID`
- bucket permissions showing `read`, `write`, and `owner`

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
