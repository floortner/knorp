# HARD CAP (enforcement, not just alerting). When ACTUAL monthly AWS spend crosses
# var.budget_hard_cap_usd, AWS Budgets automatically STOPS the EC2 instance — halting the dominant
# (compute) cost. This is the strongest AWS-native ceiling, with three honest caveats:
#   1. Billing data lags hours→~a day, so it is NOT a real-time circuit breaker — spend can modestly
#      overshoot before the action fires.
#   2. Stopping the instance takes the app OFFLINE until you manually start it again
#      (`aws ec2 start-instances --instance-ids <id>`), then re-run the deploy (or just restart the box).
#   3. A stopped instance still accrues small residual cost (EBS volumes, the now-unattached Elastic IP,
#      the hosted zone) — a few $/mo, not $0.
# Anthropic spend is separate (capped in the Anthropic console), on top of this.

# Role AWS Budgets assumes to run the stop action.
resource "aws_iam_role" "budget_action" {
  name = "${local.name}-budget-action"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

data "aws_iam_policy_document" "budget_action" {
  statement {
    sid       = "StopThisInstance"
    actions   = ["ec2:StopInstances"]
    resources = ["arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.api.id}"]
  }
  # SSM automation (the mechanism Budgets uses for STOP_EC2_INSTANCES) + status reads (no resource scoping).
  statement {
    sid = "SsmAutomationAndDescribe"
    actions = [
      "ec2:DescribeInstanceStatus",
      "ssm:StartAutomationExecution",
      "ssm:StopAutomationExecution",
      "ssm:GetAutomationExecution",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "budget_action" {
  name   = "${local.name}-budget-action"
  role   = aws_iam_role.budget_action.id
  policy = data.aws_iam_policy_document.budget_action.json
}

resource "aws_budgets_budget_action" "hard_cap" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "RUN_SSM_DOCUMENTS"
  approval_model     = "AUTOMATIC" # fire without manual approval — that's what makes it a hard cap
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action.arn

  action_threshold {
    action_threshold_type  = "ABSOLUTE_VALUE"
    action_threshold_value = var.budget_hard_cap_usd
  }

  definition {
    ssm_action_definition {
      action_sub_type = "STOP_EC2_INSTANCES"
      instance_ids    = [aws_instance.api.id]
      region          = var.region
    }
  }

  subscriber {
    address           = var.alarm_email
    subscription_type = "EMAIL"
  }
}
