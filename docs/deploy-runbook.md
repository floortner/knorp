# Beta deploy runbook — knorp.org

Step-by-step to take the beta live on AWS (ROADMAP §E). Domain **`knorp.org`** (already a Route 53
hosted zone in this account). Most provisioning is one `terraform apply`; the Console is only for account
setup + a couple of confirmations. Budget target ~€50/mo all-in.

Endpoints when done: `https://app.knorp.org` · `https://review.knorp.org` · `https://api.knorp.org`.

---

## Phase 0 — Local tooling (~5 min, macOS)
```bash
# Homebrew (skip if `brew --version` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install awscli jq
brew tap hashicorp/tap && brew install hashicorp/tap/terraform
aws --version && terraform version   # aws-cli/2.x, terraform >= 1.6
```

## Phase 1 — AWS credentials (~10 min, Console + CLI)
1. Console → **IAM → Users → Create user** `blsb-admin` → attach `AdministratorAccess`.
2. Open the user → **Security credentials → Create access key** → *Command Line Interface*.
3. Configure + verify:
   ```bash
   aws configure     # paste keys; region eu-central-1; output json
   aws sts get-caller-identity
   ```
*(More secure alternative: IAM Identity Center + `aws configure sso`. The IAM-user path is simplest solo.)*

## Phase 2 — Domain (already done ✓)
`knorp.org`'s hosted zone is already in Route 53 in this account — nothing to do. Sanity check:
```bash
aws route53 list-hosted-zones --query "HostedZones[?Name=='knorp.org.']"
```

## Phase 3 — Anthropic (~5 min)
1. https://console.anthropic.com → **API Keys** → create (`sk-ant-...`), copy.
2. **Billing → set a monthly spend limit** (e.g. €30) — the hard cap on variable cost.

*(No email provider signup needed — email is Amazon SES, provisioned by Terraform in Phase 4.)*

## Phase 4 — Provision with Terraform (~20 min)
`infra/terraform.tfvars` is already filled for `knorp.org`. Then:
```bash
cd infra
terraform init
terraform plan          # READ THIS
terraform apply         # "yes" — first apply ~15–20 min (CloudFront + ACM + SES verification)
terraform output        # save these for Phase 5c
```
> If it stalls on `aws_acm_certificate_validation`, DNS is still propagating — re-run `terraform apply`.

## Phase 5 — One-time post-apply setup (~15 min)
**5a. Confirm the budget email** — click the link in the SNS "Subscription Confirmation" mail.

**5b. Set the real secrets** in SSM (Terraform made placeholders; email needs no key — SES uses the IAM role):
```bash
P=/blsb/beta
aws ssm put-parameter --overwrite --type SecureString --name $P/JWT_SECRET        --value "$(openssl rand -hex 32)"
aws ssm put-parameter --overwrite --type SecureString --name $P/STAFF_JWT_SECRET  --value "$(openssl rand -hex 32)"
aws ssm put-parameter --overwrite --type SecureString --name $P/ANTHROPIC_API_KEY --value "sk-ant-..."
```

**5c. Request SES production access** (a fresh SES account is sandboxed — verified addresses only, 200/day).
Do it now so it's approved (~24h) by the time you invite families:
```bash
aws sesv2 put-account-details --region eu-central-1 \
  --production-access-enabled --mail-type TRANSACTIONAL \
  --website-url "https://app.knorp.org" \
  --use-case-description "Passwordless login codes for an approved-access children's literacy app (beta)."
# To test login BEFORE approval, verify your own address:
aws sesv2 create-email-identity --region eu-central-1 --email-identity florian.ortner@gmail.com
```

**5d. GitHub repo variables** — sync them from the terraform outputs (needs an authenticated `gh` CLI):
```bash
cd infra && ./set-github-vars.sh
```
Sets all 8 variables the deploy workflow reads (`AWS_DEPLOY_ROLE_ARN`, `ARTIFACTS_BUCKET`, `INSTANCE_ID`,
`APP_BUCKET`, `REVIEWER_BUCKET`, `APP_CF_ID`, `REVIEWER_CF_ID`, `API_BASE`). **Re-run after any apply that
changes an output** — especially an instance replacement (`INSTANCE_ID` goes stale otherwise).

## Phase 6 — First deploy (~10 min)
```bash
dig +short api.knorp.org     # should show `terraform output api_public_ip` (needed for the TLS cert)
```
GitHub → **Actions → "Deploy (beta)" → Run workflow**. The `api` job builds on the box (via SSM), gets the
Let's Encrypt cert, migrates, seeds, starts the API; the `web` job uploads both frontends.

## Phase 7 — Verify
```bash
curl https://api.knorp.org/api/v1/health     # {"status":"ok","version":...,"commit":...}
```
- `https://app.knorp.org` → enter `florian.ortner@gmail.com` → login code arrives (SES) → log in → run a lesson.
- `https://review.knorp.org` → log in with the same email (seeded admin reviewer) → queue loads.

## Phase 8 — Off-platform backups (recommended)
Follow the boxed steps in `deploy/README.md` (`aws ssm start-session --target <instance_id>`, install
`age`+`rclone`, drop the key/config, enable the timer). Run a restore drill periodically.

---
- **Break-glass into the box:** `aws ssm start-session --target $(cd infra && terraform output -raw instance_id)` (no SSH).
- **Teardown:** `terraform destroy` (take a `pg_dump` first — it deletes the DB volume).
