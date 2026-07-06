# Terraform + provider pins. Two AWS providers: the primary region (Frankfurt) for everything, and a
# us-east-1 alias used ONLY for the CloudFront ACM certificate (CloudFront requires its cert in us-east-1).
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Round-1 uses local state (committed to .gitignore, never to git). When you want a shared/locked
  # backend, uncomment and create the bucket + DynamoDB table first, then `terraform init -migrate-state`.
  # backend "s3" {
  #   bucket         = "blsb-tf-state"
  #   key            = "beta/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "blsb-tf-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "besserlesenschreiben"
      Environment = "beta"
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront certificates MUST live in us-east-1 regardless of where the app runs.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "besserlesenschreiben"
      Environment = "beta"
      ManagedBy   = "terraform"
    }
  }
}
