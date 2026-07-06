locals {
  name = "blsb-beta"

  app_fqdn      = "${var.app_subdomain}.${var.domain}"
  reviewer_fqdn = "${var.reviewer_subdomain}.${var.domain}"
  api_fqdn      = "${var.api_subdomain}.${var.domain}"

  # Bucket names must be globally unique; suffix with the account id.
  blob_bucket      = "${local.name}-blobs-${data.aws_caller_identity.current.account_id}"
  app_bucket       = "${local.name}-web-app-${data.aws_caller_identity.current.account_id}"
  reviewer_bucket  = "${local.name}-web-review-${data.aws_caller_identity.current.account_id}"
  artifacts_bucket = "${local.name}-artifacts-${data.aws_caller_identity.current.account_id}"

  # SSM parameter path prefix — the app's runtime secrets/config live here (SecureString).
  ssm_prefix = "/blsb/beta"
}

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "primary" {
  name         = "${var.domain}."
  private_zone = false
}
