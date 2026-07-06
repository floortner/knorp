# Round-1 uses the account's default VPC/subnet — no custom networking to manage. The instance is
# reached only on 80/443; Postgres stays on localhost and is never exposed.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "besserlesenschreiben API host: 80/443 in, all out. No SSH (deploys via SSM)."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP (Let's Encrypt HTTP-01 challenge + redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (nginx → node)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # No port 22: administration + deploys go through AWS SSM (Session Manager / Run Command).

  egress {
    description = "All outbound (package installs, Anthropic, Resend, S3, SSM)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
