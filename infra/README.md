# infra/ — beta AWS deployment (Terraform)

Stands up the first-feedback-round environment for *besserlesenschreiben* (ROADMAP §E): one small EC2
box (backend + self-hosted Postgres + nginx/Let's Encrypt), two S3+CloudFront frontends, S3 blob +
release buckets, Route 53 records, SSM config/secrets, a GitHub OIDC deploy role, and a budget alarm.

**This is authored for you to review and apply — nothing here provisions itself.** Everything is billable;
run `terraform plan` and read it before `apply`. Budget target: ~€50/mo all-in (AWS ~€16 + Anthropic ~€34).

## Prerequisites
- An AWS account + local admin credentials (`aws sts get-caller-identity` works).
- A domain you own with its **hosted zone already in Route 53**.
- Terraform ≥ 1.6.

## Apply
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill domain, owner_email, alarm_email
terraform init
terraform plan          # READ THIS
terraform apply
```
CloudFront + ACM validation take ~10–20 min on first apply. State is local (gitignored); see
`versions.tf` to switch to an S3 backend later.

## After apply — one-time setup
1. **Confirm** the budget-alert email (SNS sends a subscription confirmation).
2. **Set the real secrets** in SSM (Terraform only created placeholders):
   ```bash
   P=/blsb/beta
   aws ssm put-parameter --overwrite --type SecureString --name $P/JWT_SECRET       --value "$(openssl rand -hex 32)"
   aws ssm put-parameter --overwrite --type SecureString --name $P/STAFF_JWT_SECRET --value "$(openssl rand -hex 32)"
   aws ssm put-parameter --overwrite --type SecureString --name $P/ANTHROPIC_API_KEY --value "sk-ant-..."
   ```
   (`JWT_SECRET` and `STAFF_JWT_SECRET` must differ — the app refuses to boot otherwise. Email needs no
   key — SES authenticates via the instance role.)
3. **SES production access:** Terraform already verified the domain + created its DKIM/MAIL FROM DNS, but a
   new SES account is **sandboxed** (only verified addresses, 200/day). Request production access once —
   Console → **SES → Account dashboard → Request production access**, or:
   ```bash
   aws sesv2 put-account-details --region eu-central-1 \
     --production-access-enabled --mail-type TRANSACTIONAL \
     --website-url "https://app.<your-domain>" \
     --use-case-description "Passwordless login codes for an approved-access students' literacy app (beta)."
   ```
   Approval is usually ~24h. Until then, verify your own test addresses to try login
   (`aws sesv2 create-email-identity --email-identity you@example.com`).
4. **Anthropic:** set a hard monthly spend limit in the Anthropic console — the real cap on variable cost.
5. **Sync the GitHub Actions variables** the deploy workflow needs from the terraform outputs:
   ```bash
   ./set-github-vars.sh        # needs an authenticated `gh` CLI
   ```
   Re-run after ANY apply that changes an output — especially an instance replacement
   (`INSTANCE_ID` goes stale) or a bucket/CloudFront recreation.
6. **Deploy approval gate (security review P3-6):** create the `beta` GitHub environment with yourself
   as required reviewer — the deploy jobs declare `environment: beta`, and the IAM trust policy only
   accepts the environment-scoped OIDC sub (`repo:floortner/knorp:environment:beta`), so a run that
   skipped the gate cannot assume the deploy role:
   ```bash
   gh api -X PUT "repos/floortner/knorp/environments/beta" \
     --input - <<< "{\"reviewers\":[{\"type\":\"User\",\"id\":$(gh api user --jq .id)}]}"
   ```
   Until BOTH the environment exists and the new trust policy is applied, deploys fail at the
   assume-role step — do this and the `terraform apply` together.
7. **First deploy:** run the `Deploy` workflow (`workflow_dispatch`), approve it in the Actions UI
   (the environment gate), and its `api` job runs `deploy/release.sh` on the box (via SSM), which
   installs the systemd units + nginx, obtains the Let's Encrypt cert, migrates, seeds, and starts
   the API. The `web` job builds + uploads both frontends.

## Ops alarms (security review P3-5)

`alarms.tf` wires four alarms to the budget SNS topic (same email): EC2 status check, root +
Postgres-data-volume disk above 85%, and TLS cert under 14 days to expiry. Disk and cert metrics
come from a 5-minute on-box timer (`deploy/metrics.sh`, installed + enabled by every deploy;
`BLSB/Ops` namespace, PutMetricData scoped in `iam.tf`). Missing data is treated as **breaching**
on purpose — a silent metrics pipeline is itself an incident. Expect the disk/cert alarms to sit
in ALARM between the `apply` and the next deploy (the timer doesn't exist on the box until
`release.sh` installs it).

## Break-glass access
No SSH / no port 22. Use SSM Session Manager: `aws ssm start-session --target <instance_id>`.

## Teardown
`terraform destroy` removes everything **including the Postgres data volume**. Take an off-platform
`pg_dump` first (see `../deploy/backup.sh`).
