# infra/cdk

Skeleton of the AWS side of `docs/architecture.drawio`. Stacks are named; constructs are TODOs until there is a container image (later roadmap item).

```
bin/app.ts              wiring: Network → Db + Api; Web standalone
lib/network-stack.ts    VPC, public subnet (ALB), private subnet (Fargate, RDS)
lib/db-stack.ts         RDS PostgreSQL + Secrets Manager
lib/api-stack.ts        ECS Fargate + ALB  (not Lambda)
lib/web-stack.ts        S3 + CloudFront
```

Do not `cdk deploy` from this commit. Local data plane is Compose Postgres only.

## AWS auth (GitHub Actions)

The IAM role lives in AWS, not in git. GitHub only stores the ARN as a **repository variable** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::089941745032:role/github-actions-payment-checkout-fullstack` |
| `AWS_REGION` | `us-east-1` |

Workflows use `${{ vars.AWS_ROLE_ARN }}` with `permissions: id-token: write`. That is not a password: AWS only accepts a GitHub-signed OIDC token for this repo’s `main` branch.

PSP private key and integrity secret go in **GitHub Secrets** (`PSP_*`). Never commit them. Never put AWS access keys in Secrets.
