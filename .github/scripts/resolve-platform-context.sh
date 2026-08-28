#!/usr/bin/env bash
set -euo pipefail

vpc_id="$(aws ec2 describe-vpcs \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=CheckoutNetwork" \
  --query "Vpcs[0].VpcId" --output text)"
if [[ -z "$vpc_id" || "$vpc_id" == "None" ]]; then
  echo "CheckoutNetwork VPC was not found" >&2
  exit 1
fi

db_secret="$(aws cloudformation describe-stack-resources --stack-name CheckoutDb \
  --query "StackResources[?ResourceType=='AWS::SecretsManager::Secret'].PhysicalResourceId" \
  --output text | awk '{print $1}')"
db_sg="$(aws cloudformation describe-stack-resources --stack-name CheckoutDb \
  --query "StackResources[?ResourceType=='AWS::EC2::SecurityGroup'].PhysicalResourceId" \
  --output text | awk '{print $1}')"
alb_dns="$(aws cloudformation describe-stacks --stack-name CheckoutApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiAlbDns'].OutputValue" --output text)"

if [[ -z "$db_secret" || "$db_secret" == "None" ]]; then
  echo "CheckoutDb secret was not found" >&2
  exit 1
fi
if [[ -z "$db_sg" || "$db_sg" == "None" ]]; then
  echo "CheckoutDb security group was not found" >&2
  exit 1
fi
if [[ -z "$alb_dns" || "$alb_dns" == "None" ]]; then
  echo "CheckoutApi ApiAlbDns output was not found" >&2
  exit 1
fi

{
  echo "CHECKOUT_VPC_ID=${vpc_id}"
  echo "CHECKOUT_DB_SECRET_ARN=${db_secret}"
  echo "CHECKOUT_DB_SG_ID=${db_sg}"
  echo "CHECKOUT_API_ALB_DNS=${alb_dns}"
} >> "$GITHUB_ENV"

echo "Resolved vpc=${vpc_id} alb=${alb_dns}"
