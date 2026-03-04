#!/bin/sh
set -eu

if [ "${GARAGE_AUTO_BOOTSTRAP:-false}" != "true" ]; then
  exit 0
fi

if [ -z "${OBJECT_STORAGE_BUCKET:-}" ] || [ -z "${OBJECT_STORAGE_ACCESS_KEY_ID:-}" ] || [ -z "${OBJECT_STORAGE_SECRET_ACCESS_KEY:-}" ]; then
  echo "garage bootstrap skipped: object storage bucket or credentials are missing" >&2
  exit 0
fi

attempt=0
until /garage status >/tmp/garage-status.txt 2>/tmp/garage-status.err; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    cat /tmp/garage-status.err >&2 || true
    echo "garage bootstrap failed: server did not become ready" >&2
    exit 1
  fi
  sleep 1
done

node_id="$(awk '/^[0-9a-f]{16}[[:space:]]/ { print $1; exit }' /tmp/garage-status.txt)"
if [ -z "$node_id" ]; then
  cat /tmp/garage-status.txt >&2 || true
  echo "garage bootstrap failed: could not determine node id" >&2
  exit 1
fi

/garage layout assign -z "${GARAGE_BOOTSTRAP_ZONE:-garage}" -c "${GARAGE_BOOTSTRAP_CAPACITY:-10GB}" "$node_id" >/tmp/garage-layout-assign.txt 2>&1 || true
/garage layout apply --version "${GARAGE_LAYOUT_VERSION:-1}" >/tmp/garage-layout-apply.txt 2>&1 || true
/garage bucket create "${OBJECT_STORAGE_BUCKET}" >/tmp/garage-bucket-create.txt 2>&1 || true
/garage key import --yes -n "${GARAGE_KEY_NAME:-inko-app}" "${OBJECT_STORAGE_ACCESS_KEY_ID}" "${OBJECT_STORAGE_SECRET_ACCESS_KEY}" >/tmp/garage-key-import.txt 2>&1 || true
/garage bucket allow --read --write --owner "${OBJECT_STORAGE_BUCKET}" --key "${OBJECT_STORAGE_ACCESS_KEY_ID}" >/tmp/garage-bucket-allow.txt 2>&1 || true
