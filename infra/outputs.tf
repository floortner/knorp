output "api_url" {
  description = "Backend base URL (health at /api/v1/health)."
  value       = "https://${local.api_fqdn}/api/v1"
}

output "app_url" {
  description = "Family PWA URL."
  value       = "https://${local.app_fqdn}"
}

output "reviewer_url" {
  description = "Reviewer portal URL."
  value       = "https://${local.reviewer_fqdn}"
}

output "instance_id" {
  description = "EC2 instance id (SSM Run Command / Session Manager target)."
  value       = aws_instance.api.id
}

output "api_public_ip" {
  description = "Elastic IP the api. A record points at."
  value       = aws_eip.api.public_ip
}

output "blob_bucket" {
  description = "S3 blob bucket (AWS_S3_BUCKET)."
  value       = aws_s3_bucket.blob.bucket
}

output "artifacts_bucket" {
  description = "S3 bucket the deploy job uploads backend release tarballs to."
  value       = aws_s3_bucket.artifacts.bucket
}

output "app_bucket" {
  description = "S3 bucket for the family web build."
  value       = aws_s3_bucket.app.bucket
}

output "reviewer_bucket" {
  description = "S3 bucket for the reviewer web build."
  value       = aws_s3_bucket.reviewer.bucket
}

output "app_cloudfront_id" {
  description = "CloudFront distribution id (family) — for cache invalidation."
  value       = aws_cloudfront_distribution.app.id
}

output "reviewer_cloudfront_id" {
  description = "CloudFront distribution id (reviewer) — for cache invalidation."
  value       = aws_cloudfront_distribution.reviewer.id
}

output "github_deploy_role_arn" {
  description = "Role the GitHub Actions deploy workflow assumes via OIDC. Set as the AWS_DEPLOY_ROLE_ARN repo variable/secret."
  value       = aws_iam_role.deploy.arn
}

output "ssm_prefix" {
  description = "SSM Parameter Store path holding the app's runtime config/secrets."
  value       = local.ssm_prefix
}
