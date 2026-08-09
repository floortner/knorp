# Operational CloudWatch alarms (security review P3-5) → the existing budget SNS topic (budget.tf),
# which already emails var.alarm_email. Three failure modes a €50/mo single-box setup must not
# discover from users: the instance dying, the Postgres data volume filling (Postgres dies on a full
# disk), and TLS cert renewal silently failing.
#
# StatusCheckFailed is a built-in EC2 metric. Disk usage and cert expiry are NOT visible to
# CloudWatch without an agent — a small on-box timer publishes them to the BLSB/Ops namespace
# (deploy/metrics.sh, installed+enabled by every deploy; IAM grant in iam.tf). Alarms treat missing
# data as breaching on purpose: a metric that stops arriving means the box or the timer is broken,
# which is itself an incident (dead-man principle, same as the backup healthcheck).
#
# Cost: alarms are inside the always-free tier (10); the 3 custom metrics ≈ $0.90/mo.

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  alarm_name          = "${local.name}-instance-status"
  alarm_description   = "EC2 status check failing — the API box is unreachable or unhealthy."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.api.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.budget.arn]
  ok_actions          = [aws_sns_topic.budget.arn]
}

resource "aws_cloudwatch_metric_alarm" "disk_data" {
  alarm_name          = "${local.name}-disk-pgdata"
  alarm_description   = "Postgres data volume above 85% — Postgres dies on a full disk."
  namespace           = "BLSB/Ops"
  metric_name         = "disk_used_percent"
  dimensions          = { InstanceId = aws_instance.api.id, Path = "/var/lib/pgsql" }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.budget.arn]
  ok_actions          = [aws_sns_topic.budget.arn]
}

resource "aws_cloudwatch_metric_alarm" "disk_root" {
  alarm_name          = "${local.name}-disk-root"
  alarm_description   = "Root volume above 85% — releases/logs will start failing."
  namespace           = "BLSB/Ops"
  metric_name         = "disk_used_percent"
  dimensions          = { InstanceId = aws_instance.api.id, Path = "/" }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.budget.arn]
  ok_actions          = [aws_sns_topic.budget.arn]
}

# certbot renews ~30 days before expiry; 14 days remaining means renewal has been failing for two
# weeks — loud, but with time to fix before HTTPS breaks. Metric publishes every 5 min; a 6h
# Minimum window keeps the alarm robust to single missed runs while still alerting same-day.
resource "aws_cloudwatch_metric_alarm" "cert_expiry" {
  alarm_name          = "${local.name}-cert-expiry"
  alarm_description   = "API TLS certificate under 14 days to expiry — certbot renewal is failing."
  namespace           = "BLSB/Ops"
  metric_name         = "cert_days_remaining"
  dimensions          = { InstanceId = aws_instance.api.id }
  statistic           = "Minimum"
  period              = 21600
  evaluation_periods  = 1
  threshold           = 14
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.budget.arn]
  ok_actions          = [aws_sns_topic.budget.arn]
}
