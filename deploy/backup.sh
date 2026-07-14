#!/usr/bin/env bash
# Off-platform, client-side-encrypted Postgres backup (ROADMAP §E / ARCHITECTURE §7). Dumps the DB,
# encrypts with `age` to a recipient whose PRIVATE key is held OUTSIDE AWS, and pushes to a non-AWS
# object store via `rclone` — so an AWS account suspension costs uptime, not data.
#
# Config in /etc/blsb/backup.env (root-only), e.g.:
#   AGE_RECIPIENT=age1qz...         # public key; private key kept off-box
#   BACKUP_REMOTE=r2:blsb-backups   # an rclone remote (Cloudflare R2 / Backblaze B2 / …)
#   PRUNE_MIN_AGE=35d               # optional: delete remote objects older than this
#   HEALTHCHECK_URL=https://hc-ping.com/<uuid>   # optional dead-man's-switch (see below)
#
# BACKUP SURVIVABILITY (security review P2-7):
#   * Prefer a WRITE-ONLY rclone token (Backblaze B2 / Cloudflare R2 both support keys without delete) and
#     do retention via the provider's OBJECT-LIFECYCLE rules — NOT on-box `rclone delete`. Then an attacker
#     who roots this box can append backups but cannot wipe the existing ones. Leave PRUNE_MIN_AGE unset
#     when you do this; the on-box prune below runs only if you deliberately opt into a delete-capable token.
#   * Set HEALTHCHECK_URL to a free healthchecks.io (or similar) check. A missed OR failed run then alerts
#     you — the difference between "we have backups" and "we discover months of silent failures too late."
set -euo pipefail

# shellcheck disable=SC1091
source /etc/blsb/backup.env
: "${AGE_RECIPIENT:?}" "${BACKUP_REMOTE:?}"

# On ANY failure, ping the healthcheck's /fail endpoint (if configured) so a broken backup pages you
# instead of failing silently. `|| true` so the ping never masks the real exit code.
hc_ping() { [ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 "${HEALTHCHECK_URL}$1" >/dev/null 2>&1 || true; }
trap 'hc_ping /fail' ERR

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/var/tmp/blsb-${STAMP}.sql.gz.age"

# Dump as the DB owner over the local socket, compress, encrypt — all streamed, nothing in cleartext on disk.
sudo -u blsb pg_dump --no-owner --no-privileges blsb | gzip | age -r "$AGE_RECIPIENT" -o "$FILE"

rclone copyto "$FILE" "${BACKUP_REMOTE}/blsb-${STAMP}.sql.gz.age"
rm -f "$FILE"

# Optional retention prune on the remote. PREFER provider lifecycle rules + a write-only token instead
# (see the survivability note above); this on-box delete only works with a delete-capable credential and
# is the very thing a box compromise could turn against you.
if [ -n "${PRUNE_MIN_AGE:-}" ]; then
  rclone delete --min-age "$PRUNE_MIN_AGE" "$BACKUP_REMOTE" || true
fi

echo "backup ${STAMP} pushed to ${BACKUP_REMOTE}"
hc_ping ""  # success ping — resets the dead-man's-switch timer

# --- restore drill (documented; run manually into a throwaway DB) ---
#   rclone cat "$BACKUP_REMOTE/blsb-<STAMP>.sql.gz.age" | age -d -i backup-key.txt | gunzip | psql <throwaway>
