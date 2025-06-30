# Terraform AWS Deployment Guide for Arca DeFi Platform

## 🚀 Quick Start (For Experienced Users)

If you're familiar with Terraform and AWS, here's the TL;DR:

1. **Terraform Cloud**: Create account → Create workspace → Add AWS credentials
2. **Local setup**: `terraform login` → Copy backend.tf templates
3. **Deploy**: `cd terraform/environments/testnet` → `terraform init` → `terraform apply`
4. **Verify**: Check Amplify console → Test domain → Confirm alerts

**🔍 For detailed instructions**, continue reading below.

---

This guide deploys AWS infrastructure for the **arca-contracts** repository using Terraform, focusing on:
- AWS Amplify for the React frontend (arcafi.com)
- Route53 domain management
- Smart contract deployment workflows
- Monitoring and alerting infrastructure
- GitHub Actions CI/CD for frontend and contracts

## Important: Repository Separation

This project follows a **separation of concerns** architecture:

### **arca-contracts** (This Repository)
- **Scope**: Frontend UI, smart contracts, deployment scripts
- **Infrastructure**: AWS Amplify, Route53, contract deployment automation
- **Terraform**: Manages only frontend and contract-related resources

### **arca** (Separate Private Repository)
- **Scope**: Python rebalancing bot
- **Infrastructure**: EC2 instances, bot-specific secrets
- **Terraform**: Manages only bot-related resources

**Benefits of this separation**:
- 🔒 **Security**: Bot secrets isolated from public repository
- 🚀 **Independent Deployments**: Frontend and bot can deploy separately
- 🎯 **Clear Ownership**: Each team owns their infrastructure
- 💰 **Cost Allocation**: Easy to track costs per component
- 🔧 **Simpler State Management**: No tangled dependencies

### Shared Resources

Some resources are shared between repositories:
- **SNS Alert Topics**: Both repos can publish alerts
- **CloudWatch Dashboards**: Unified monitoring view
- **Route53 Hosted Zone**: Domain shared by frontend and APIs

## Prerequisites

- [ ] AWS Account with billing enabled
- [ ] Terraform Cloud account (free tier)
- [ ] Terraform CLI installed (v1.5+)
- [ ] AWS IAM user with programmatic access
- [ ] GitHub repository with admin access
- [ ] Domain registered in Route 53 (arcafi.com)
- [ ] GitHub personal access token

## Project Structure

Create the following directory structure within **this repository**:

```
arca-contracts/
├── terraform/
│   ├── environments/
│   │   ├── testnet/
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   └── mainnet/
│   │       ├── terraform.tfvars
│   │       └── backend.tf
│   ├── modules/
│   │   ├── amplify/          # Frontend hosting
│   │   ├── route53/          # Domain management
│   │   ├── monitoring/       # Alerts and dashboards
│   │   └── shared/           # Shared resources (SNS topics)
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── .github/
│   └── workflows/
│       ├── pipeline.yml      # Existing validation pipeline
│       ├── deploy-frontend.yml
│       └── deploy-contracts.yml
└── scripts/
    └── deploy-contracts.ts   # Contract deployment script
```

## Phase 1: Terraform Cloud Setup

### 1.1 Create Terraform Cloud Account

- [ ] **Sign up** at [https://app.terraform.io](https://app.terraform.io)
- [ ] **Create an organization** (e.g., "arca-finance")
- [ ] **Create workspaces** for each environment:
  - [ ] `arca-frontend-testnet`
  - [ ] `arca-frontend-mainnet`

### 1.2 Configure Backend

- [ ] Create `terraform/environments/testnet/backend.tf`:

```hcl
terraform {
  cloud {
    organization = "arca-finance"  # ⚠️ Replace with YOUR org name
    
    workspaces {
      name = "arca-frontend-testnet"
    }
  }
}
```

- [ ] Create `terraform/environments/mainnet/backend.tf`:

```hcl
terraform {
  cloud {
    organization = "arca-finance"  # ⚠️ Replace with YOUR org name
    
    workspaces {
      name = "arca-frontend-mainnet"
    }
  }
}
```

### 1.3 Configure Workspace Variables

In Terraform Cloud UI for each workspace:

- [ ] **Navigate to** Variables → Environment Variables
- [ ] **Add AWS Credentials** (mark as sensitive ✓):
  - [ ] `AWS_ACCESS_KEY_ID`
  - [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] **Add GitHub Token** (mark as sensitive ✓):
  - [ ] `TF_VAR_github_token`
- [ ] **Add other sensitive variables**:
  - [ ] `TF_VAR_alert_email`

**💡 Tip**: Make sure to select "Environment variable" not "Terraform variable" for AWS credentials!

### 1.4 Local Setup

```bash
# Install Terraform CLI if needed
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Login to Terraform Cloud
terraform login
# This opens your browser - approve and paste token

# Verify login
terraform auth show
```

### 1.5 (Optional) GitHub Integration

For automated deployments on git push:

- [ ] **In Terraform Cloud**: Settings → Version Control → Connect to GitHub
- [ ] **Select your repository**: `arca-contracts`
- [ ] **Configure workspace**:
  - [ ] Working Directory: `terraform/environments/testnet`
  - [ ] Auto-apply: **Off** (require manual approval)
  - [ ] Trigger: Only on push to `production` branch

**Benefits**:
- Push code → Automatic plan
- Review changes in UI → Apply
- No local `terraform apply` needed!

## Why Terraform Cloud?

For a team of 2-3 developers, Terraform Cloud offers significant advantages:

| Feature | Local State | S3 Backend | Terraform Cloud |
|---------|-------------|------------|----------------|
| **Setup Time** | 0 minutes | 15 minutes | 5 minutes |
| **Cost** | $0 | ~$0.30/month | $0 (free tier) |
| **Collaboration** | Git conflicts | Basic | Excellent |
| **Secret Management** | .env files | Manual | Built-in UI |
| **Audit Trail** | None | CloudTrail | Full history |
| **Remote Runs** | No | No | Yes |
| **PR Integration** | None | None | Automatic |
| **State Locking** | None | DynamoDB | Built-in |

## Phase 2: Main Terraform Configuration

### 2.1 Root Configuration

- [ ] Create `terraform/main.tf`:

```hcl
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "Arca"
      Repository  = "arca-contracts"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = "DeFi-Frontend"
    }
  }
}

provider "github" {
  token = var.github_token
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Route53 Module for Domain Management
module "route53" {
  source = "./modules/route53"
  
  domain_name = var.domain_name
  environment = var.environment
}

# Shared Resources Module (SNS topics for cross-repo alerts)
module "shared" {
  source = "./modules/shared"
  
  environment = var.environment
  alert_email = var.alert_email
}

# Amplify Module for Frontend
module "amplify" {
  source = "./modules/amplify"
  
  environment       = var.environment
  github_repository = var.github_repository
  github_token      = var.github_token
  domain_name       = var.domain_name
  branch_name       = var.branch_name
  hosted_zone_id    = module.route53.hosted_zone_id
  
  # Contract deployment info
  contract_addresses = var.contract_addresses
}

# Monitoring Module for Frontend
module "monitoring" {
  source = "./modules/monitoring"
  
  environment      = var.environment
  amplify_app_id   = module.amplify.app_id
  sns_topic_arn    = module.shared.alerts_topic_arn
}
```

### 2.2 Variables Definition

- [ ] Create `terraform/variables.tf`:

```hcl
variable "environment" {
  description = "Environment name (testnet or mainnet)"
  type        = string
  validation {
    condition     = contains(["testnet", "mainnet"], var.environment)
    error_message = "Environment must be testnet or mainnet"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "github_repository" {
  description = "GitHub repository URL"
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "arcafi.com"
}

variable "branch_name" {
  description = "Git branch to deploy"
  type        = string
  default     = "production"
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}

variable "contract_addresses" {
  description = "Deployed contract addresses"
  type = object({
    vault         = string
    queue_handler = string
    fee_manager   = string
    reward_claimer = string
  })
  default = {
    vault         = ""
    queue_handler = ""
    fee_manager   = ""
    reward_claimer = ""
  }
}
```

## Phase 3: Module Implementations

### 3.1 Route53 Module

- [ ] Create directory: `terraform/modules/route53/`
- [ ] Create `terraform/modules/route53/main.tf`:

```hcl
# Check if the domain already exists in Route53
data "aws_route53_zone" "existing" {
  count        = var.create_hosted_zone ? 0 : 1
  name         = var.domain_name
  private_zone = false
}

# Create hosted zone only if it doesn't exist
resource "aws_route53_zone" "main" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.domain_name
  
  tags = {
    Name        = var.domain_name
    Environment = var.environment
  }
}

# Output the zone ID regardless of whether we created it
locals {
  hosted_zone_id = var.create_hosted_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.existing[0].zone_id
}

# Health check for frontend
resource "aws_route53_health_check" "frontend" {
  fqdn              = var.environment == "mainnet" ? var.domain_name : "${var.environment}.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = "3"
  request_interval  = "30"
  
  tags = {
    Name        = "arca-${var.environment}-frontend-health"
    Environment = var.environment
  }
}

# Variables
variable "domain_name" {
  description = "Domain name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "create_hosted_zone" {
  description = "Whether to create a new hosted zone"
  type        = bool
  default     = false # Assume it exists since you already registered it
}

# Outputs
output "hosted_zone_id" {
  value = local.hosted_zone_id
}

output "name_servers" {
  value = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : []
}
```

### 3.2 Shared Module

- [ ] Create directory: `terraform/modules/shared/`
- [ ] Create `terraform/modules/shared/main.tf`:

```hcl
# SNS Topic for cross-repository alerts
resource "aws_sns_topic" "alerts" {
  name = "arca-${var.environment}-alerts"
  
  kms_master_key_id = "alias/aws/sns"
  
  tags = {
    Name        = "arca-${var.environment}-alerts"
    Environment = var.environment
    Purpose     = "Cross-repository alert notifications"
  }
}

# Email subscription
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Create an SNS topic policy that allows both repositories to publish
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# S3 bucket for shared contract ABIs and deployment info
resource "aws_s3_bucket" "contract_artifacts" {
  bucket = "arca-${var.environment}-contract-artifacts-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "contract_artifacts" {
  bucket = aws_s3_bucket.contract_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "contract_artifacts" {
  bucket = aws_s3_bucket.contract_artifacts.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "SNS topic ARN for alerts (share with bot repository)"
}

output "contract_artifacts_bucket" {
  value       = aws_s3_bucket.contract_artifacts.id
  description = "S3 bucket for contract deployment artifacts"
}
```

### 3.3 Amplify Module

- [ ] Create directory: `terraform/modules/amplify/`
- [ ] Create `terraform/modules/amplify/main.tf`:

```hcl
# Amplify App
resource "aws_amplify_app" "frontend" {
  name       = "arca-${var.environment}"
  repository = var.github_repository
  
  access_token = var.github_token
  
  # OAuth token for GitHub (more secure than personal token)
  # oauth_token = var.github_oauth_token
  
  build_spec = <<-EOT
    version: 1
    applications:
      - frontend:
          phases:
            preBuild:
              commands:
                - npm ci --audit
                - npm audit fix --audit-level=critical || true
                - echo "Running security checks..."
                - npm run lint
                # Update contract addresses if provided
                - |
                  if [ ! -z "$CONTRACT_VAULT_ADDRESS" ]; then
                    echo "Updating contract addresses..."
                    cat > src/config/contracts.json <<EOF
                    {
                      "vault": "$CONTRACT_VAULT_ADDRESS",
                      "queueHandler": "$CONTRACT_QUEUE_HANDLER_ADDRESS",
                      "feeManager": "$CONTRACT_FEE_MANAGER_ADDRESS",
                      "rewardClaimer": "$CONTRACT_REWARD_CLAIMER_ADDRESS"
                    }
                  EOF
                  fi
            build:
              commands:
                - npm run build
                - echo "Build completed on $(date)"
          artifacts:
            baseDirectory: dist/public
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
        appRoot: UI
  EOT
  
  environment_variables = merge(
    {
      AMPLIFY_MONOREPO_APP_ROOT = "UI"
      VITE_NETWORK_TYPE         = var.environment == "mainnet" ? "mainnet" : "testnet"
      VITE_ENABLE_TESTNETS      = var.environment == "mainnet" ? "false" : "true"
      _LIVE_UPDATES             = "[{\"pkg\":\"@aws-amplify/cli\",\"type\":\"npm\",\"version\":\"latest\"}]"
    },
    # Add contract addresses as environment variables
    var.contract_addresses.vault != "" ? {
      CONTRACT_VAULT_ADDRESS         = var.contract_addresses.vault
      CONTRACT_QUEUE_HANDLER_ADDRESS = var.contract_addresses.queue_handler
      CONTRACT_FEE_MANAGER_ADDRESS   = var.contract_addresses.fee_manager
      CONTRACT_REWARD_CLAIMER_ADDRESS = var.contract_addresses.reward_claimer
    } : {}
  )
  
  custom_rule {
    source = "/<*>"
    status = "404"
    target = "/index.html"
  }
  
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }
}

# Branch Configuration
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name
  
  enable_auto_build = true
  stage            = var.environment == "mainnet" ? "PRODUCTION" : "DEVELOPMENT"
  
  environment_variables = {
    VITE_DEPLOYMENT_ENV = var.environment
  }
}

# Domain Association
resource "aws_amplify_domain_association" "main" {
  app_id      = aws_amplify_app.frontend.id
  domain_name = var.domain_name
  
  # Subdomain configuration based on environment
  dynamic "sub_domain" {
    for_each = var.environment == "mainnet" ? ["www", "", "app"] : [var.environment]
    content {
      branch_name = aws_amplify_branch.main.branch_name
      prefix      = sub_domain.value
    }
  }
  
  wait_for_verification = true
  
  depends_on = [var.hosted_zone_id] # Ensure Route53 is ready
}

# Webhook for GitHub
resource "aws_amplify_webhook" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Trigger build on push"
}

# WAF Web ACL for DeFi security
resource "aws_wafv2_web_acl" "frontend" {
  count = var.environment == "mainnet" ? 1 : 0 # Only for production
  
  name  = "arca-${var.environment}-frontend-waf"
  scope = "CLOUDFRONT"
  
  default_action {
    allow {}
  }
  
  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }
  
  # Geo-blocking rule (optional - block high-risk countries)
  rule {
    name     = "GeoBlockingRule"
    priority = 2
    
    action {
      block {}
    }
    
    statement {
      geo_match_statement {
        country_codes = var.blocked_countries
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlockingRule"
      sampled_requests_enabled   = true
    }
  }
  
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ArcaFrontendWAF"
    sampled_requests_enabled   = true
  }
  
  tags = {
    Name = "arca-${var.environment}-frontend-waf"
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository URL"
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name"
  type        = string
}

variable "branch_name" {
  description = "Git branch to deploy"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "contract_addresses" {
  description = "Deployed contract addresses"
  type = object({
    vault         = string
    queue_handler = string
    fee_manager   = string
    reward_claimer = string
  })
}

variable "blocked_countries" {
  description = "Country codes to block (2-letter ISO)"
  type        = list(string)
  default     = [] # Add countries like ["KP", "IR"] if needed
}

# Outputs
output "app_id" {
  value = aws_amplify_app.frontend.id
}

output "default_domain" {
  value = aws_amplify_app.frontend.default_domain
}

output "production_url" {
  value = var.environment == "mainnet" ? "https://${var.domain_name}" : "https://${var.environment}.${var.domain_name}"
}

output "webhook_url" {
  value     = aws_amplify_webhook.main.url
  sensitive = true
}
```

### 3.4 Monitoring Module

- [ ] Create directory: `terraform/modules/monitoring/`
- [ ] Create `terraform/modules/monitoring/main.tf`:

```hcl
# CloudWatch Log Group for Amplify
resource "aws_cloudwatch_log_group" "amplify" {
  name              = "/aws/amplify/arca-${var.environment}"
  retention_in_days = 30
  
  tags = {
    Name        = "arca-${var.environment}-amplify-logs"
    Environment = var.environment
  }
}

# CloudWatch Alarms for Frontend
resource "aws_cloudwatch_metric_alarm" "amplify_4xx" {
  alarm_name          = "arca-${var.environment}-frontend-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrors"
  namespace           = "AWS/Amplify"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "High 4xx errors on frontend"
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    App = var.amplify_app_id
  }
  
  alarm_actions = [var.sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "amplify_5xx" {
  alarm_name          = "arca-${var.environment}-frontend-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5xxErrors"
  namespace           = "AWS/Amplify"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "5xx errors on frontend"
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    App = var.amplify_app_id
  }
  
  alarm_actions = [var.sns_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "amplify_build_failure" {
  alarm_name          = "arca-${var.environment}-frontend-build-failure"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Builds"
  namespace           = "AWS/Amplify"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Frontend build failed"
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    App    = var.amplify_app_id
    Result = "SUCCEEDED"
  }
  
  alarm_actions = [var.sns_topic_arn]
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "frontend" {
  dashboard_name = "arca-${var.environment}-frontend-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Amplify", "Requests", "App", var.amplify_app_id, { stat = "Sum" }],
            [".", "4xxErrors", ".", ".", { stat = "Sum", color = "#ff9900" }],
            [".", "5xxErrors", ".", ".", { stat = "Sum", color = "#d62728" }]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Frontend Traffic Overview"
          yAxis = {
            left = {
              showUnits = false
            }
          }
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Amplify", "Latency", "App", var.amplify_app_id, { stat = "Average" }],
            ["...", { stat = "p99", color = "#ff9900" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Response Times"
          yAxis = {
            left = {
              showUnits = true
              label     = "Milliseconds"
            }
          }
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Amplify", "BytesDownloaded", "App", var.amplify_app_id, { stat = "Sum" }],
            [".", "BytesUploaded", ".", ".", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Data Transfer"
          yAxis = {
            left = {
              showUnits = true
            }
          }
        }
      },
      {
        type   = "log"
        width  = 12
        height = 6
        properties = {
          query   = "SOURCE '/aws/amplify/arca-${var.environment}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 50"
          region  = data.aws_region.current.name
          title   = "Recent Frontend Errors"
        }
      }
    ]
  })
}

# Custom Metrics for Contract Interactions
resource "aws_cloudwatch_log_metric_filter" "contract_calls" {
  name           = "arca-${var.environment}-contract-calls"
  pattern        = "[timestamp, request_id, event_type=CONTRACT_CALL, contract_name, method_name, ...]"
  log_group_name = aws_cloudwatch_log_group.amplify.name
  
  metric_transformation {
    name      = "ContractCalls"
    namespace = "Arca/Frontend"
    value     = "1"
    
    dimensions = {
      Environment = var.environment
      Contract    = "$contract_name"
      Method      = "$method_name"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "amplify_app_id" {
  description = "Amplify app ID"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  type        = string
}

# Data sources
data "aws_region" "current" {}

# Outputs
output "dashboard_url" {
  value = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.frontend.dashboard_name}"
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.amplify.name
}
```

## Phase 4: GitHub Actions CI/CD

### 4.1 Frontend Deployment

- [ ] Create `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend

on:
  push:
    branches:
      - production
    paths:
      - 'UI/**'
      - '.github/workflows/deploy-frontend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: UI/package-lock.json
      
      - name: Install dependencies
        working-directory: UI
        run: npm ci --audit
      
      - name: Run security audit
        working-directory: UI
        run: |
          npm audit --production
          npm audit fix --audit-level=critical || true
      
      - name: Run linting
        working-directory: UI
        run: npm run lint
      
      - name: Run tests
        working-directory: UI
        run: npm test -- --passWithNoTests
      
      - name: Build application
        working-directory: UI
        run: npm run build
        env:
          VITE_NETWORK_TYPE: ${{ github.ref == 'refs/heads/production' && 'mainnet' || 'testnet' }}
      
      - name: Trigger Amplify build
        run: |
          curl -X POST ${{ secrets.AMPLIFY_WEBHOOK_URL }}
      
      - name: Notify success
        if: success()
        run: echo "Frontend deployed successfully to Amplify"
      
      - name: Notify failure
        if: failure()
        run: echo "Frontend deployment failed"
```

### 4.2 Contract Deployment

- [ ] Create `.github/workflows/deploy-contracts.yml`:

```yaml
name: Deploy Contracts

on:
  workflow_dispatch:
    inputs:
      network:
        description: 'Network to deploy to'
        required: true
        type: choice
        options:
          - testnet
          - mainnet
      confirm_mainnet:
        description: 'Type "DEPLOY" to confirm mainnet deployment'
        required: false
        type: string

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate mainnet deployment
        if: inputs.network == 'mainnet' && inputs.confirm_mainnet != 'DEPLOY'
        run: |
          echo "❌ Mainnet deployment requires confirmation"
          echo "Please type 'DEPLOY' in the confirmation field"
          exit 1

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: ${{ inputs.network }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          submodules: recursive
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Compile contracts
        run: npm run compile
      
      - name: Run tests
        run: npm run test
      
      - name: Deploy contracts
        run: |
          npx hardhat run scripts/deployArcaSystem.ts --network ${{ inputs.network }}
        env:
          DEPLOYER_PRIVATE_KEY: ${{ secrets.DEPLOYER_PRIVATE_KEY }}
          INFURA_API_KEY: ${{ secrets.INFURA_API_KEY }}
      
      - name: Verify contracts
        run: |
          npm run deploy:verify -- --network ${{ inputs.network }}
        continue-on-error: true
      
      - name: Export deployment data
        run: |
          npm run deploy:export
      
      - name: Upload deployment artifacts
        uses: actions/upload-artifact@v3
        with:
          name: deployment-${{ inputs.network }}-${{ github.run_id }}
          path: |
            exports/deployments.json
            exports/abis/
      
      - name: Update frontend with contract addresses
        if: success()
        run: |
          # Trigger Amplify rebuild with new contract addresses
          curl -X POST \
            -H "Content-Type: application/json" \
            -d '{"contractAddresses": '$(cat exports/deployments.json)'}' \
            ${{ secrets.AMPLIFY_WEBHOOK_URL }}
      
      - name: Notify deployment
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const status = '${{ job.status }}' === 'success' ? '✅' : '❌';
            const message = `${status} Contract deployment to ${{ inputs.network }} ${status === '✅' ? 'succeeded' : 'failed'}`;
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: message
            });
```

### 4.3 Update Existing Pipeline

Add to your existing `.github/workflows/pipeline.yml`:

```yaml
# Add to existing pipeline.yml
  contract-safety-check:
    name: Contract Safety Check
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'contracts/')
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for upgrade safety
        run: |
          npx hardhat compile
          npx hardhat run scripts/checkUpgradeSafety.ts
      
      - name: Gas estimation
        run: |
          npx hardhat test --grep "gas estimation"
      
      - name: Slither analysis
        uses: crytic/slither-action@v0.3.0
        with:
          target: 'contracts/'
          slither-args: '--exclude naming-convention,external-function,low-level-calls'
```

## Phase 5: Deployment Instructions

### 5.1 Environment Configuration

- [ ] Create `terraform/environments/testnet/terraform.tfvars`:

```hcl
environment         = "testnet"
aws_region         = "us-east-1"
github_repository  = "https://github.com/yourusername/arca-contracts"
domain_name        = "arcafi.com"
branch_name        = "production"
alert_email        = "alerts@arcafi.com"

# Contract addresses (update after deployment)
contract_addresses = {
  vault         = ""
  queue_handler = ""
  fee_manager   = ""
  reward_claimer = ""
}
```

### 5.2 Deploy Infrastructure

- [ ] **Navigate to testnet environment**:
  ```bash
  cd terraform/environments/testnet
  ```

- [ ] **Initialize Terraform** (connects to Terraform Cloud):
  ```bash
  terraform init
  # You should see: "Terraform Cloud has been successfully initialized!"
  ```

- [ ] **Review the deployment plan**:
  ```bash
  terraform plan
  # This runs remotely in Terraform Cloud
  # Review the resources that will be created
  ```

- [ ] **Apply changes** (runs in Terraform Cloud):
  ```bash
  terraform apply
  # You'll see: "Running apply in Terraform Cloud. Output will stream here."
  # Type 'yes' when prompted
  ```
  
  **🔗 Pro tip**: Click the link in terminal to view detailed progress in browser!

- [ ] **Save outputs for reference**:
  ```bash
  terraform output -json > outputs.json
  ```

**Note**: The actual terraform run happens in Terraform Cloud, not on your local machine. This means:
- Your AWS credentials never touch your laptop
- Team members can see exactly what changed
- You have a complete audit trail
- Runs can be approved via mobile app

### 5.3 Configure GitHub Secrets

Add these secrets to your GitHub repository:

- `AMPLIFY_WEBHOOK_URL` (from Terraform output)
- `DEPLOYER_PRIVATE_KEY` (for contract deployment)
- `INFURA_API_KEY` (or your RPC provider)

**Note**: AWS credentials are stored in Terraform Cloud, not GitHub Secrets. This is more secure since GitHub Actions never see your AWS keys.

### 5.4 Verify Deployment

1. **Check Amplify Console**: Verify app is created and building
2. **Verify Domain**: DNS records should be automatically configured
3. **Test Alerts**: Subscribe to SNS topic email
4. **View Dashboard**: Access CloudWatch dashboard URL from outputs

## Phase 6: Production Deployment

When ready for mainnet:

1. Create `terraform/environments/mainnet/terraform.tfvars`
2. Update with mainnet-specific values
3. Deploy contracts to mainnet (manual process)
4. Update `contract_addresses` in terraform.tfvars
5. Run `terraform apply` in mainnet environment

## Security Best Practices

### For DeFi Applications

1. **WAF Protection**: Enabled for mainnet only
2. **Rate Limiting**: 2000 requests per 5 minutes per IP
3. **Geo-Blocking**: Optional blocking of high-risk countries
4. **HTTPS Only**: Automatic SSL certificates
5. **Security Headers**: Configured via Amplify

### Contract Deployment Security

1. **Manual Mainnet Deployment**: Requires explicit confirmation
2. **Automated Testing**: All tests must pass before deployment
3. **Gas Estimation**: Prevents expensive deployments
4. **Slither Analysis**: Static security analysis

## Cost Optimization

### Estimated Monthly Costs

- **Amplify**: ~$1-5 for small sites
- **Route53**: $0.50 per hosted zone + queries
- **CloudWatch**: ~$3-5 for logs and dashboards
- **SNS**: $0.50 per million notifications
- **Total**: ~$5-15/month for small DeFi frontend

### Cost Saving Tips

1. Use CloudWatch log retention policies
2. Configure Amplify build cache
3. Optimize bundle sizes to reduce bandwidth
4. Use CloudFront caching effectively

## Troubleshooting

### Common Issues

1. **Terraform Cloud Connection**
   - Run `terraform login` if authentication fails
   - Check organization and workspace names match exactly
   - Verify you have access to the workspace

2. **Domain Not Working**
   - Verify Route53 hosted zone
   - Check Amplify domain association
   - Wait for DNS propagation (up to 48 hours)

3. **Build Failures**
   - Check Node version matches local
   - Verify all environment variables in Terraform Cloud UI
   - Review build logs in Amplify console

4. **Contract Address Updates**
   - Update terraform.tfvars after deployment
   - Run `terraform apply` to update Amplify
   - Trigger manual build if needed

5. **Permission Errors**
   - Verify AWS credentials in Terraform Cloud have sufficient permissions
   - Check IAM policy includes all required services
   - Ensure workspace variables are marked as "Environment" not "Terraform" variables

## Future Enhancements

See `TERRAFORM_FUTURE_ENHANCEMENTS.md` for advanced features like:
- AWS Systems Manager for secure access
- Multi-region deployment
- Advanced monitoring with Datadog
- Blue/green deployments
- Infrastructure cost analysis

## 🎉 Success Checklist

Once deployment is complete, verify:

- [ ] **Amplify App**: Shows in AWS Console with "Deployed" status
- [ ] **Domain**: `https://testnet.arcafi.com` loads your app
- [ ] **Monitoring**: CloudWatch dashboard shows metrics
- [ ] **Alerts**: You received SNS subscription email
- [ ] **GitHub Actions**: Webhooks are configured
- [ ] **Terraform Cloud**: Shows successful run history

## 🚀 Next Steps

1. **Test the deployment**: Make a small change to UI and push to trigger auto-deploy
2. **Configure WAF rules**: Add specific rules for your DeFi app
3. **Set up budget alerts**: Monitor AWS costs
4. **Review security**: Run AWS Security Hub assessment
5. **Plan for mainnet**: Test everything thoroughly on testnet first!

---

**💬 Need help?** 
- Check Terraform Cloud run logs for detailed errors
- Review AWS CloudWatch logs for runtime issues
- Verify all prerequisites are completed
- Ensure sensitive variables are in Terraform Cloud, not in files

This guide provides a production-ready infrastructure for your Arca DeFi frontend with clear separation from the bot infrastructure. The modular design allows easy scaling and maintenance as your platform grows.