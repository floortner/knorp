variable "region" {
  description = "Primary AWS region (data residency: EU / Frankfurt)."
  type        = string
  default     = "eu-central-1"
}

variable "domain" {
  description = "Registrable domain you already own, whose hosted zone is in Route 53 (e.g. \"knorp.org\"). All three apps are subdomains of this so the SameSite=Lax login cookie crosses app.↔api."
  type        = string
}

variable "app_subdomain" {
  description = "Family PWA subdomain."
  type        = string
  default     = "app"
}

variable "reviewer_subdomain" {
  description = "Staff reviewer portal subdomain."
  type        = string
  default     = "review"
}

variable "api_subdomain" {
  description = "Backend API subdomain (points at the EC2 instance)."
  type        = string
  default     = "api"
}

variable "instance_type" {
  description = "EC2 instance type. t4g.small = 2 vCPU / 2 GB (Graviton/arm64) — headroom for Postgres + Node + on-box build."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume size (OS + app builds)."
  type        = number
  default     = 20
}

variable "data_volume_gb" {
  description = "Separate EBS volume for the Postgres data directory (survives instance replacement)."
  type        = number
  default     = 20
}

variable "github_repo" {
  description = "owner/repo trusted by the GitHub Actions OIDC deploy role."
  type        = string
  default     = "floortner/knorp"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set to false if your account already has one (a duplicate URL fails) — it will be looked up instead."
  type        = bool
  default     = true
}

variable "github_deploy_refs" {
  description = "Git refs allowed to assume the deploy role (tags + main). Least-privilege: only these can deploy."
  type        = list(string)
  default     = ["repo:floortner/knorp:ref:refs/tags/v*", "repo:floortner/knorp:ref:refs/heads/main"]
}

variable "owner_email" {
  description = "Owner email: seeded as the admin reviewer (STAFF_ADMIN_EMAILS), the Let's Encrypt registration address, and the default EMAIL_FROM sender local-part domain."
  type        = string
}

variable "alarm_email" {
  description = "Email subscribed to the budget SNS topic (confirm the subscription once, out of band). Usually the same as owner_email."
  type        = string
}

variable "monthly_budget_usd" {
  description = "AWS Budgets monthly cost alarm threshold (USD). The €50 all-in ceiling minus Anthropic headroom; alert well before it."
  type        = number
  default     = 25
}

# (Email is Amazon SES — Terraform manages its DKIM/MAIL FROM DNS in ses.tf; no per-provider records var.)
