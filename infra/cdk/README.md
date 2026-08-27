# infra/cdk

AWS side of `docs/architecture.drawio`. GitHub Actions on `main` deploys in order:

`CheckoutNetwork` → pause → `CheckoutDb` (RDS) → pause → `CheckoutApi` (Fargate + ALB) → health wait → `CheckoutWeb` (S3 + CloudFront) → HTTPS health wait.

```
bin/app.ts              wiring: Network → Db → Api → Web
lib/network-stack.ts    VPC, public subnets (ALB + Fargate), isolated subnets (RDS), no NAT
lib/db-stack.ts         RDS PostgreSQL + Secrets Manager
lib/api-stack.ts        ECS Fargate + ALB  (not Lambda)
lib/web-stack.ts        S3 + CloudFront HTTPS; `/api/*` and `/docs*` → ALB
```

HTTPS is the CloudFront default certificate. The ALB stays HTTP; the SPA calls `/api/v1` on the same CloudFront host.

PSP keys are upserted to Secrets Manager (`checkout/psp`) from GitHub Secrets **before** `cdk deploy`. They never go into CloudFormation parameters.

## AWS auth (GitHub Actions)

The IAM role lives in AWS, not in git. GitHub only stores the ARN as a **repository variable** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::089941745032:role/github-actions-payment-checkout-fullstack` |
| `AWS_REGION` | `us-east-1` |

Workflows use `${{ vars.AWS_ROLE_ARN }}` with `permissions: id-token: write`. That is not a password: AWS only accepts a GitHub-signed OIDC token for this repo’s `main` branch.

PSP private key and integrity secret go in **GitHub Secrets** (`PSP_*`). The SPA public key goes in `VITE_PSP_*`. Never commit them. Never put AWS access keys in Secrets.

Local data plane is still Compose Postgres only (`../docker-compose.yml`).
