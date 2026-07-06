# Latest Amazon Linux 2023 arm64 AMI (Graviton) via the public SSM parameter.
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

# Pin the instance to one default subnet + its AZ (the data volume must share the AZ).
data "aws_subnet" "selected" {
  id = data.aws_subnets.default.ids[0]
}

# Separate EBS volume for the Postgres data dir — survives instance replacement (pg_dump is the off-box tier).
resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_subnet.selected.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  encrypted         = true
  tags = {
    Name = "${local.name}-pgdata"
  }
}

resource "aws_instance" "api" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.selected.id
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  root_block_device {
    volume_size = var.root_volume_gb
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  user_data = templatefile("${path.module}/cloud-init.sh.tftpl", {
    data_device = "/dev/sdf"
  })

  tags = {
    Name = "${local.name}-api"
  }

  lifecycle {
    # AMI id changes as Amazon publishes new AL2023 builds — don't force-replace the box (and its DB) on
    # every `apply`. Replace deliberately when you want to move AMIs.
    ignore_changes = [ami]
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.api.id
}

# Stable public IP for the api. A record.
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"
  tags = {
    Name = "${local.name}-api"
  }
}
