#!/usr/bin/env bash
# Render the app's runtime environment from SSM Parameter Store to a root-only systemd EnvironmentFile.
# Every key under $SSM_PREFIX becomes KEY=value. Run as root (reads SecureString values with decryption).
set -euo pipefail

SSM_PREFIX="${SSM_PREFIX:-/blsb/beta}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
OUT="${OUT:-/etc/blsb/env}"

install -d -m 750 "$(dirname "$OUT")"
umask 077
TMP="$(mktemp)"

# aws cli v2 auto-paginates get-parameters-by-path. Emit "name<TAB>value" and keep only the leaf key.
aws ssm get-parameters-by-path \
  --path "$SSM_PREFIX" \
  --with-decryption \
  --recursive \
  --region "$AWS_REGION" \
  --query 'Parameters[].[Name,Value]' \
  --output text |
while IFS=$'\t' read -r name value; do
  key="${name##*/}"
  # systemd EnvironmentFile: KEY=value, value is the rest of the line (no quoting needed).
  printf '%s=%s\n' "$key" "$value"
done > "$TMP"

install -m 600 -o root -g root "$TMP" "$OUT"
rm -f "$TMP"
echo "rendered $(wc -l < "$OUT") vars → $OUT"
