#!/usr/bin/env bash
set -euo pipefail
SPA="$(aws cloudformation describe-stacks --stack-name CheckoutWeb \
  --query "Stacks[0].Outputs[?OutputKey=='SpaUrl'].OutputValue" --output text)"
echo "Waiting for ${SPA}/api/v1/health"
for i in $(seq 1 40); do
  if curl -fsS "${SPA}/api/v1/health" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "CloudFront healthy"
    {
      echo "## Live URLs"
      echo "- SPA: ${SPA}"
      echo "- API: ${SPA}/api/v1"
      echo "- Swagger: ${SPA}/docs"
    } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  echo "attempt ${i}/40 — sleeping 20s"
  sleep 20
done
echo "API did not become healthy on CloudFront"
exit 1
