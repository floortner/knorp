# ---------------------------------------------------------------------------
# App runtime config in SSM Parameter Store under ${local.ssm_prefix}. deploy/release.sh fetches this
# whole path (--with-decryption) and renders it to a root-only systemd EnvironmentFile at each deploy.
#
# Non-secret config is managed here by Terraform. Secrets are created as empty SecureString PLACEHOLDERS
# whose value Terraform then ignores — set the real values ONCE, out of band, e.g.:
#   aws ssm put-parameter --overwrite --type SecureString \
#     --name /blsb/beta/JWT_SECRET --value "$(openssl rand -hex 32)"
# ---------------------------------------------------------------------------

locals {
  ssm_config = {
    NODE_ENV               = "production"
    PORT                   = "3000"
    WEB_ORIGIN             = "https://${local.app_fqdn}"
    REVIEWER_ORIGIN        = "https://${local.reviewer_fqdn}"
    PUBLIC_API_URL         = "https://${local.api_fqdn}/api/v1"
    API_FQDN               = local.api_fqdn
    LETSENCRYPT_EMAIL      = var.owner_email
    DATABASE_URL           = "postgresql://blsb@localhost/blsb?host=/var/run/postgresql"
    AWS_S3_BUCKET          = aws_s3_bucket.blob.bucket
    AWS_REGION             = var.region
    EMAIL_PROVIDER         = "ses"
    EMAIL_FROM             = "besserlesenschreiben <login@${var.domain}>"
    STAFF_ADMIN_EMAILS     = join(",", length(var.staff_admin_emails) > 0 ? var.staff_admin_emails : [var.owner_email])
    ANTHROPIC_MODEL        = "claude-sonnet-4-6"
    ANTHROPIC_VISION_MODEL = "claude-opus-4-8"
    LLM_RESIDENCY_ACK      = "true"
    # Tight beta caps (default 5/60) — protect the Anthropic budget; tune after watching real usage.
    LLM_SESSIONS_PER_DAY  = "3"
    CHAT_MESSAGES_PER_DAY = "20"
  }

  # SES authenticates via the instance role, so there is no email API key. (Set EMAIL_KEY only if you
  # switch EMAIL_PROVIDER to 'resend'.)
  ssm_secrets = ["JWT_SECRET", "STAFF_JWT_SECRET", "ANTHROPIC_API_KEY"]
}

resource "aws_ssm_parameter" "config" {
  for_each = local.ssm_config
  name     = "${local.ssm_prefix}/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "secret" {
  for_each = toset(local.ssm_secrets)
  name     = "${local.ssm_prefix}/${each.value}"
  type     = "SecureString"
  value    = "CHANGE_ME" # placeholder — set the real value out of band; Terraform ignores it thereafter.

  lifecycle {
    ignore_changes = [value]
  }
}
