# app. / trainer. → CloudFront (alias A records); api. → the EC2 Elastic IP.
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.app_fqdn
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "trainer" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.trainer_fqdn
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.trainer.domain_name
    zone_id                = aws_cloudfront_distribution.trainer.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.api_fqdn
  type    = "A"
  ttl     = 300
  records = [aws_eip.api.public_ip]
}

# (Email deliverability DNS — SES DKIM + MAIL FROM — is managed in ses.tf.)
