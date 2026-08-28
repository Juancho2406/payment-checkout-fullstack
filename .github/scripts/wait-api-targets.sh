#!/usr/bin/env bash
set -euo pipefail
TG="$(aws cloudformation describe-stacks --stack-name CheckoutApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiTargetGroupArn'].OutputValue" --output text)"
echo "Waiting for target group ${TG}"
for i in $(seq 1 40); do
  HEALTHY="$(aws elbv2 describe-target-health --target-group-arn "$TG" \
    --query "length(TargetHealthDescriptions[?TargetHealth.State=='healthy'])" --output text)"
  TOTAL="$(aws elbv2 describe-target-health --target-group-arn "$TG" \
    --query "length(TargetHealthDescriptions)" --output text)"
  echo "attempt ${i}/40 — healthy ${HEALTHY}/${TOTAL}"
  if [ "$TOTAL" != "0" ] && [ "$HEALTHY" = "$TOTAL" ]; then
    echo "API targets healthy"
    exit 0
  fi
  sleep 15
done
echo "API targets did not become healthy"
exit 1
