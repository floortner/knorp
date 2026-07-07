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

# Pull the few values this script needs. DO NOT `source` the env file: it is a systemd EnvironmentFile
# with unquoted values — EMAIL_FROM contains `<login@…>` which bash would parse as a redirection.
envval() { grep -m1 "^$1=" /etc/blsb/env | cut -d= -f2-; }
API_FQDN="$(envval API_FQDN)"
DATABASE_URL="$(envval DATABASE_URL)"
STAFF_ADMIN_EMAILS="$(envval STAFF_ADMIN_EMAILS)"
LETSENCRYPT_EMAIL="$(envval LETSENCRYPT_EMAIL)"
: "${API_FQDN:?missing API_FQDN in SSM}"
: "${DATABASE_URL:?missing DATABASE_URL in SSM}"

# 2. Build the backend as the runtime user (devDeps needed for nest/tsx/prisma CLIs; NOT NODE_ENV=production).
chown -R blsb:blsb "$RELEASE_DIR"
sudo -u blsb bash -c "cd '$BE' && npm ci --include=dev && npx prisma generate && npm run build"

# 3. Migrations (pre-traffic) + idempotent seed, as blsb (peer auth over the unix socket).
# Guard: child data must live on the dedicated EBS data volume, never the root disk. If the
# blsb-pgdata mount is missing (cloud-init raced the volume attachment, drift, …), fail the deploy
# loudly instead of migrating onto the root volume.
mountpoint -q /var/lib/pgsql || {
  echo "FATAL: /var/lib/pgsql is not a dedicated mount — Postgres would live on the root volume." >&2
  echo "       Check 'systemctl status blsb-pgdata' / 'lsblk' on the box, then re-run the deploy." >&2
  exit 1
}
sudo -u blsb bash -c "cd '$BE' && DATABASE_URL='$DATABASE_URL' npx prisma migrate deploy"
sudo -u blsb bash -c "cd '$BE' && DATABASE_URL='$DATABASE_URL' STAFF_ADMIN_EMAILS='${STAFF_ADMIN_EMAILS:-}' NODE_ENV=production npx prisma db seed"

# 4. Flip the current symlink the systemd unit points at.
ln -sfn "$RELEASE_DIR" /opt/blsb/current

# 5. systemd unit.
install -m 644 "$RELEASE_DIR/deploy/blsb-api.service" /etc/systemd/system/blsb-api.service
systemctl daemon-reload
systemctl enable blsb-api

# 6. nginx site + TLS. Render the template ONLY on first deploy — after that certbot OWNS the file
# (it rewrites it with the :443 server + redirect); re-rendering would clobber TLS. (Exactly that bug
# silently killed HTTPS on the second beta deploy: template overwrote the 443 block, and the cert-dir
# check skipped certbot, so nothing restored it.)
if [ ! -f /etc/nginx/conf.d/blsb-api.conf ]; then
  sed "s/__API_FQDN__/$API_FQDN/g" "$RELEASE_DIR/deploy/nginx-api.conf.template" > /etc/nginx/conf.d/blsb-api.conf
fi
systemctl enable --now nginx
nginx -t && systemctl reload nginx
CERTBOT="$(command -v certbot || echo /usr/local/bin/certbot)"
# Ensure the HTTPS server exists — first deploy obtains the cert; later deploys SELF-HEAL a config
# that lost its 443 block (an existing cert is reinstalled, not reissued: --keep-until-expiring).
if ! grep -q 'listen 443' /etc/nginx/conf.d/blsb-api.conf; then
  echo "==> configuring TLS for $API_FQDN (DNS must already point here)"
  "$CERTBOT" --nginx -d "$API_FQDN" --non-interactive --agree-tos \
    -m "${LETSENCRYPT_EMAIL:-admin@$API_FQDN}" --redirect --keep-until-expiring
  nginx -t && systemctl reload nginx
fi
# Renewal timer: certbot is pip-installed (no dnf package on AL2023), so no timer ships with it —
# without this the cert silently expires after 90 days. Idempotent.
if [ ! -f /etc/systemd/system/certbot-renew.timer ]; then
  cat > /etc/systemd/system/certbot-renew.service <<UNIT
[Unit]
Description=Certbot renewal
[Service]
Type=oneshot
ExecStart=$CERTBOT renew --quiet --nginx
UNIT
  cat > /etc/systemd/system/certbot-renew.timer <<UNIT
[Unit]
Description=Twice-daily certbot renewal
[Timer]
OnCalendar=*-*-* 03:41:00
OnCalendar=*-*-* 15:41:00
RandomizedDelaySec=1800
Persistent=true
[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now certbot-renew.timer
fi

# 7. Restart the API and smoke-check (retry: Nest+Prisma cold boot can take >3s on a t4g.small).
systemctl restart blsb-api
HEALTHY=""
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3000/api/v1/health" >/dev/null 2>&1; then HEALTHY=1; break; fi
  sleep 2
done
if [ -n "$HEALTHY" ]; then
  echo "==> health OK — release $RELEASE live"
else
  echo "!! health check failed after 60s; recent logs:" >&2
  journalctl -u blsb-api -n 40 --no-pager >&2 || true
  exit 1
fi

# 8. Prune old release dirs (each holds source + node_modules on the 20 GB root disk) — keep the
# 3 newest, never the one `current` points at.
CURRENT_TARGET="$(readlink -f /opt/blsb/current || true)"
ls -1dt /opt/blsb/releases/*/ 2>/dev/null | tail -n +4 | while read -r old; do
  [ "$(readlink -f "$old")" = "$CURRENT_TARGET" ] && continue
  echo "==> pruning old release $old"
  rm -rf "$old"
done
