#!/usr/bin/env bash
# Off-platform, client-side-encrypted Postgres backup (ROADMAP §E / ARCHITECTURE §7). Dumps the DB,
# encrypts with `age` to a recipient whose PRIVATE key is held OUTSIDE AWS, and pushes to a non-AWS
# object store via `rclone` — so an AWS account suspension costs uptime, not data.
#
# Config in /etc/blsb/backup.env (root-only), e.g.:
#   AGE_RECIPIENT=age1qz...         # public key; private key kept off-box
#   BACKUP_REMOTE=r2:blsb-backups   # an rclone remote (Cloudflare R2 / Backblaze B2 / …)
#   PRUNE_MIN_AGE=35d               # optional: delete remote objects older than this
set -euo pipefail

# shellcheck disable=SC1091
source /etc/blsb/backup.env
: "${AGE_RECIPIENT:?}" "${BACKUP_REMOTE:?}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/var/tmp/blsb-${STAMP}.sql.gz.age"

# Dump as the DB owner over the local socket, compress, encrypt — all streamed, nothing in cleartext on disk.
sudo -u blsb pg_dump --no-owner --no-privileges blsb | gzip | age -r "$AGE_RECIPIENT" -o "$FILE"

rclone copyto "$FILE" "${BACKUP_REMOTE}/blsb-${STAMP}.sql.gz.age"
rm -f "$FILE"

# Optional retention prune on the remote (align with the 7-daily/4-weekly posture).
if [ -n "${PRUNE_MIN_AGE:-}" ]; then
  rclone delete --min-age "$PRUNE_MIN_AGE" "$BACKUP_REMOTE" || true
fi

echo "backup ${STAMP} pushed to ${BACKUP_REMOTE}"

# --- restore drill (documented; run manually into a throwaway DB) ---
#   rclone cat "$BACKUP_REMOTE/blsb-<STAMP>.sql.gz.age" | age -d -i backup-key.txt | gunzip | psql <throwaway>
