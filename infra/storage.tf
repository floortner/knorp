# ---------------------------------------------------------------------------
# S3 buckets: blobs (homework/sessions/digests), two static web origins, and release artifacts.
# All private; the web buckets are reachable only through their CloudFront OAC.
# ---------------------------------------------------------------------------

# ---- Blob bucket (per-user prefixes; app reads/writes via presigned URLs) ----
resource "aws_s3_bucket" "blob" {
  bucket = local.blob_bucket
}

resource "aws_s3_bucket_public_access_block" "blob" {
  bucket                  = aws_s3_bucket.blob.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "blob" {
  bucket = aws_s3_bucket.blob.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Raw homework images are transient — auto-delete on schedule (ARCHITECTURE §7 / minors'-data posture).
resource "aws_s3_bucket_lifecycle_configuration" "blob" {
  bucket = aws_s3_bucket.blob.id
  rule {
    id     = "expire-raw-homework"
    status = "Enabled"
    filter {
      prefix = "users/"
    }
    # Applies to homework uploads; tighten/relax to match your retention decision.
    expiration {
      days = 90
    }
  }
}

# ---- CORS for presigned GET of homework images from the frontends ----
resource "aws_s3_bucket_cors_configuration" "blob" {
  bucket = aws_s3_bucket.blob.id
  cors_rule {
    allowed_methods = ["GET", "PUT"]
    allowed_origins = ["https://${local.app_fqdn}", "https://${local.trainer_fqdn}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# ---- Static web buckets (private; CloudFront OAC only) ----
resource "aws_s3_bucket" "app" {
  bucket = local.app_bucket
}

resource "aws_s3_bucket" "trainer" {
  bucket = local.trainer_bucket
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket                  = aws_s3_bucket.app.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "trainer" {
  bucket                  = aws_s3_bucket.trainer.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Grant each CloudFront distribution read access to its bucket via the OAC (SourceArn-scoped).
data "aws_iam_policy_document" "app_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.app.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.app.arn]
    }
  }
}

data "aws_iam_policy_document" "trainer_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.trainer.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.trainer.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "app" {
  bucket = aws_s3_bucket.app.id
  policy = data.aws_iam_policy_document.app_bucket.json
}

resource "aws_s3_bucket_policy" "trainer" {
  bucket = aws_s3_bucket.trainer.id
  policy = data.aws_iam_policy_document.trainer_bucket.json
}

# ---- Release artifacts (backend source tarballs the deploy job uploads) ----
resource "aws_s3_bucket" "artifacts" {
  bucket = local.artifacts_bucket
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter {
      prefix = "releases/"
    }
    expiration {
      days = 30
    }
  }
}
