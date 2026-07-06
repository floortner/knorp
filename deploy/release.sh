#!/usr/bin/env bash
# On-box release. Run as ROOT from the root of an extracted release tarball (cwd contains
# besserlesenschreiben/backend + deploy/). Invoked by the GitHub Actions `api` job via SSM Run Command,
# which downloads the tarball, extracts it, and execs this script.
#
# Idempotent: (re)renders env from SSM, builds the backend ON THE BOX (arm64 → correct Prisma engine),
# runs migrations + seed, installs the systemd unit + nginx site, obtains TLS on first run, flips the
# `current` symlink, and restarts the API.
#
# Env in: RELEASE (git sha/tag), SSM_PREFIX (default /blsb/beta), AWS_REGION (default eu-central-1).
set -euo pipefail

RELEASE_DIR="$(pwd)"
BE="$RELEASE_DIR/besserlesenschreiben/backend"
RELEASE="${RELEASE:-manual-$(date +%s)}"
export SSM_PREFIX="${SSM_PREFIX:-/blsb/beta}"
export AWS_REGION="${AWS_REGION:-eu-central-1}"

echo "==> release $RELEASE from $RELEASE_DIR"

# 1. Render runtime env from SSM → /etc/blsb/env, then stamp the deployed commit.
bash "$RELEASE_DIR/deploy/render-env.sh"
grep -q '^GIT_COMMIT=' /etc/blsb/env && sed -i "s/^GIT_COMMIT=.*/GIT_COMMIT=$RELEASE/" /etc/blsb/env \
  || echo "GIT_COMMIT=$RELEASE" >> /etc/blsb/env

# Pull the few non-secret values this script needs (peer-auth DB URL, FQDN, admin email).
# shellcheck disable=SC1091
source /etc/blsb/env
: "${API_FQDN:?missing API_FQDN in SSM}"
: "${DATABASE_URL:?missing DATABASE_URL in SSM}"

# 2. Build the backend as the runtime user (devDeps needed for nest/tsx/prisma CLIs; NOT NODE_ENV=production).
chown -R blsb:blsb "$RELEASE_DIR"
sudo -u blsb bash -c "cd '$BE' && npm ci --include=dev && npx prisma generate && npm run build"

# 3. Migrations (pre-traffic) + idempotent seed, as blsb (peer auth over the unix socket).
sudo -u blsb bash -c "cd '$BE' && DATABASE_URL='$DATABASE_URL' npx prisma migrate deploy"
sudo -u blsb bash -c "cd '$BE' && DATABASE_URL='$DATABASE_URL' STAFF_ADMIN_EMAILS='${STAFF_ADMIN_EMAILS:-}' NODE_ENV=production npx prisma db seed"

# 4. Flip the current symlink the systemd unit points at.
ln -sfn "$RELEASE_DIR" /opt/blsb/current

# 5. systemd unit.
install -m 644 "$RELEASE_DIR/deploy/blsb-api.service" /etc/systemd/system/blsb-api.service
systemctl daemon-reload
systemctl enable blsb-api

# 6. nginx site (HTTP form) + TLS on first run.
sed "s/__API_FQDN__/$API_FQDN/g" "$RELEASE_DIR/deploy/nginx-api.conf.template" > /etc/nginx/conf.d/blsb-api.conf
systemctl enable --now nginx
nginx -t && systemctl reload nginx
CERTBOT="$(command -v certbot || echo /usr/local/bin/certbot)"
if [ ! -d "/etc/letsencrypt/live/$API_FQDN" ]; then
  echo "==> obtaining Let's Encrypt cert for $API_FQDN (DNS must already point here)"
  "$CERTBOT" --nginx -d "$API_FQDN" --non-interactive --agree-tos \
    -m "${LETSENCRYPT_EMAIL:-admin@$API_FQDN}" --redirect
fi

# 7. Restart the API and smoke-check.
systemctl restart blsb-api
sleep 3
if curl -fsS "http://127.0.0.1:3000/api/v1/health" >/dev/null; then
  echo "==> health OK — release $RELEASE live"
else
  echo "!! health check failed; recent logs:" >&2
  journalctl -u blsb-api -n 40 --no-pager >&2 || true
  exit 1
fi
