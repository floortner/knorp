# Reviewer → Trainer rename (2026-07-24): pure address renames so `terraform apply` updates the
# existing resources instead of destroying/recreating them. The S3 bucket keeps its physical
# `-web-review-` name (bucket names are immutable; renaming would destroy the serving bucket).
# The real changes an apply performs: new ACM cert SAN (trainer.<domain>), CloudFront alias +
# Route53 A record trainer.<domain> (review.<domain> stops resolving), SSM TRAINER_ORIGIN.

moved {
  from = aws_s3_bucket.reviewer
  to   = aws_s3_bucket.trainer
}

moved {
  from = aws_s3_bucket_public_access_block.reviewer
  to   = aws_s3_bucket_public_access_block.trainer
}

moved {
  from = aws_s3_bucket_policy.reviewer
  to   = aws_s3_bucket_policy.trainer
}

moved {
  from = aws_cloudfront_distribution.reviewer
  to   = aws_cloudfront_distribution.trainer
}

moved {
  from = aws_route53_record.reviewer
  to   = aws_route53_record.trainer
}
