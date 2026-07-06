# Amazon SES: verified domain identity with Easy DKIM + a custom MAIL FROM (SPF alignment). Terraform
# creates all the DNS records for you — no dashboard copy-paste. The app authenticates via the IAM
# instance role (no API key). NOTE: a new SES account is SANDBOXED — request production access to email
# arbitrary family addresses (see infra/README.md).
resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Easy-DKIM: three CNAMEs proving domain ownership + signing.
resource "aws_route53_record" "ses_dkim" {
  for_each = toset(aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens)
  zone_id  = data.aws_route53_zone.primary.zone_id
  name     = "${each.value}._domainkey.${var.domain}"
  type     = "CNAME"
  ttl      = 1800
  records  = ["${each.value}.dkim.amazonses.com"]
}

# Custom MAIL FROM (mail.<domain>) so SPF aligns — improves deliverability / avoids spam folders.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${var.domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "mail.${var.domain}"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "mail.${var.domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}
