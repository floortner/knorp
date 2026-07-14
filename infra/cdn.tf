# Two CloudFront distributions (family PWA + reviewer portal), each fronting its private S3 bucket via a
# shared Origin Access Control. PriceClass_100 = US/EU edges only (cheapest; covers the audience).
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# AWS-managed cache policies (stable IDs).
locals {
  cache_optimized = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized (hashed, immutable assets)
  cache_disabled  = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled (index.html + service worker)

  # Content-Security-Policy for both SPAs (security review P1-3). Both apps are fully self-contained
  # (fonts bundled via @fontsource, no CDN scripts, no inline <script>), so script/default stay 'self'.
  # Inline styles ARE used (per-unit theme colours, a11y font scaling) → style-src needs 'unsafe-inline'.
  # Cross-origin needs: the API (a sibling subdomain) for XHR, and the blob bucket for presigned homework
  # image GETs. Validate in staging before relying on it — a too-tight CSP fails closed.
  csp = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://${local.blob_bucket}.s3.${var.region}.amazonaws.com data:",
    "font-src 'self'",
    "connect-src 'self' https://${local.api_fqdn}",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
}

# Shared security-response-headers policy attached to both distributions' behaviours (security review
# P1-3): HSTS, the CSP above, nosniff, frame-deny, and a referrer policy that keeps presigned-URL query
# strings out of the Referer header.
resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${local.name}-security-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000 # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [local.app_fqdn]
  price_class         = "PriceClass_100"
  comment             = "besserlesenschreiben family PWA"

  origin {
    origin_id                = "app-s3"
    domain_name              = aws_s3_bucket.app.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id           = "app-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # SPA shell + service worker must never be cached, so deploys are picked up immediately.
  ordered_cache_behavior {
    path_pattern               = "/index.html"
    target_origin_id           = "app-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_disabled
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }
  ordered_cache_behavior {
    path_pattern               = "/sw.js"
    target_origin_id           = "app-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_disabled
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Client-side routing: unknown paths return the SPA shell.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.web.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_distribution" "reviewer" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [local.reviewer_fqdn]
  price_class         = "PriceClass_100"
  comment             = "besserlesenschreiben reviewer portal"

  origin {
    origin_id                = "reviewer-s3"
    domain_name              = aws_s3_bucket.reviewer.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id           = "reviewer-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  ordered_cache_behavior {
    path_pattern               = "/index.html"
    target_origin_id           = "reviewer-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_disabled
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.web.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
