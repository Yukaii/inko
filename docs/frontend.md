# Frontend

Frontend app: `apps/web` (Vite + React + TypeScript).

API base URL:

- local dev: leave `VITE_API_URL` unset so requests use same-origin `/api/*`; Vite proxies `/api` to `http://localhost:4000`
- production monolith: leave `VITE_API_URL` unset so requests use same-origin `/api/*`
- split-origin deployments: set `VITE_API_URL` to the API origin

Common commands:

- `vp run --filter @inko/web dev`
- `vp run --filter @inko/web test`
- `vp run --filter @inko/web lint`
- `vp run --filter @inko/web build`
