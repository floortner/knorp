#!/usr/bin/env bash
# Sync the GitHub Actions repository variables the deploy workflow needs from the current
# `terraform output`s. Run from infra/ after ANY apply that changes an output — especially an
# instance replacement (INSTANCE_ID goes stale otherwise) or a CloudFront/bucket recreation.
#
# Prereqs: terraform state present in this directory; `gh` CLI authenticated with repo access.
set -euo pipefail

REPO="${REPO:-floortner/knorp}"
cd "$(dirname "$0")"

# "GITHUB_VAR:terraform_output" pairs (plain list — macOS bash 3.2 has no associative arrays).
MAPPINGS="
AWS_DEPLOY_ROLE_ARN:github_deploy_role_arn
ARTIFACTS_BUCKET:artifacts_bucket
INSTANCE_ID:instance_id
APP_BUCKET:app_bucket
REVIEWER_BUCKET:reviewer_bucket
APP_CF_ID:app_cloudfront_id
REVIEWER_CF_ID:reviewer_cloudfront_id
API_BASE:api_url
"

fail=0
for pair in $MAPPINGS; do
  var="${pair%%:*}"
  out="${pair#*:}"
  val="$(terraform output -raw "$out" 2>/dev/null || true)"
  if [ -z "$val" ]; then
    echo "⚠️  $var: terraform output '$out' is empty — is the apply complete?" >&2
    fail=1
    continue
  fi
  gh variable set "$var" --body "$val" -R "$REPO" >/dev/null
  echo "✓ $var = $val"
done

[ "$fail" -eq 0 ] && echo "All deploy variables synced to $REPO." || { echo "Some variables missing — fix and re-run." >&2; exit 1; }
