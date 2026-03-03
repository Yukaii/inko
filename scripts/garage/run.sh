#!/bin/sh
set -eu

mkdir -p /var/lib/garage/meta /var/lib/garage/data /etc

cat >/etc/garage.toml <<EOF
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1

rpc_bind_addr = "0.0.0.0:3901"
rpc_public_addr = "${GARAGE_RPC_PUBLIC_ADDR:-127.0.0.1:3901}"
rpc_secret = "${GARAGE_RPC_SECRET}"

[s3_api]
s3_region = "${GARAGE_REGION:-garage}"
api_bind_addr = "0.0.0.0:3900"

[admin]
api_bind_addr = "0.0.0.0:3903"
admin_token = "${GARAGE_ADMIN_TOKEN}"
EOF

/garage server &
garage_pid=$!

if [ "${GARAGE_AUTO_BOOTSTRAP:-false}" = "true" ]; then
  /app/bootstrap.sh
fi

wait "$garage_pid"
