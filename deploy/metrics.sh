#!/usr/bin/env bash
# Publish the ops metrics CloudWatch can't see without an agent (security review P3-5; alarms in
# infra/alarms.tf): disk_used_percent for / and the Postgres data volume, cert_days_remaining for
# the API TLS cert. Runs every 5 min via blsb-metrics.timer (installed by deploy/release.sh); auth
# is the instance role (PutMetricData scoped to the BLSB/Ops namespace — infra/iam.tf).
#
# Failure mode is deliberate: if this script breaks, the metrics stop and the alarms treat missing
# data as breaching — the monitoring monitors itself.
set -euo pipefail

NAMESPACE=BLSB/Ops
IMDS=http://169.254.169.254/latest

TOKEN=$(curl -sf -X PUT "$IMDS/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
IID=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" "$IMDS/meta-data/instance-id")
REGION=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" "$IMDS/meta-data/placement/region")

disk_pct() { df --output=pcent "$1" 2>/dev/null | tail -1 | tr -dc '0-9'; }

put_disk() {
  local path="$1" pct
  pct=$(disk_pct "$path")
  [ -n "$pct" ] || return 0 # path not mounted (fresh box mid-bootstrap) → no datapoint, alarm covers it
  aws cloudwatch put-metric-data --region "$REGION" --namespace "$NAMESPACE" \
    --metric-name disk_used_percent --unit Percent --value "$pct" \
    --dimensions "InstanceId=$IID,Path=$path"
}

put_disk /
put_disk /var/lib/pgsql

# Days until the API cert expires — an end-to-end renewal check (catches every failure cause, not
# just a failed certbot exit). No cert yet (pre-first-deploy) → no datapoint → alarm says so.
CERT=$(ls -1 /etc/letsencrypt/live/*/cert.pem 2>/dev/null | head -1 || true)
if [ -n "$CERT" ]; then
  END=$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)
  DAYS=$(( ( $(date -d "$END" +%s) - $(date +%s) ) / 86400 ))
  aws cloudwatch put-metric-data --region "$REGION" --namespace "$NAMESPACE" \
    --metric-name cert_days_remaining --unit Count --value "$DAYS" \
    --dimensions "InstanceId=$IID"
fi
