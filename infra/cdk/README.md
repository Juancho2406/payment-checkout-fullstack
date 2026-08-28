# infra/cdk

AWS side of `docs/architecture.drawio`. GitHub Actions on `main` deploys **only the slice that changed**:

| Workflow | Paths | CDK |
|---|---|---|
| `deploy-iac.yml` | `infra/cdk/**` | `target=platform` (VPC+RDS), and API/web stacks only if those templates changed |
| `deploy-api.yml` | `apps/api/**` | `target=api` — rebuilds the Fargate image, does not touch the SPA |
| `deploy-web.yml` | `apps/web/**` | `target=web` — uploads S3/CloudFront, does not rebuild the API image |

`cdk deploy -c target=…` synthesizes **only that slice**, so a CSS change does not docker-build Nest, and a use-case change does not need `apps/web/dist`.

Isolated API/web deploys pass **concrete IDs** (`-c vpcId`, `-c apiOriginHostname`, …) resolved from the live account. That avoids CloudFormation `ImportValue`: updating API must not delete an export that Web still imports.

```
bin/app.ts              wiring + `-c target`
lib/imported-platform.ts  CFN export names + imports
lib/network-stack.ts    VPC, public subnets (ALB + Fargate), isolated subnets (RDS), no NAT
lib/db-stack.ts         RDS PostgreSQL + Secrets Manager
lib/api-stack.ts        ECS Fargate + ALB  (not Lambda)
lib/web-stack.ts        S3 + CloudFront HTTPS; `/api/*` and `/docs*` → ALB
```

HTTPS is the CloudFront default certificate. The ALB stays HTTP; the SPA calls `/api/v1` on the same CloudFront host.

PSP keys are upserted to Secrets Manager (`checkout/psp`) from GitHub Secrets on API deploys. They never go into CloudFormation parameters.

## AWS auth (GitHub Actions)

The IAM role lives in AWS, not in git. GitHub only stores the ARN as a **repository variable** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::089941745032:role/github-actions-payment-checkout-fullstack` |
| `AWS_REGION` | `us-east-1` |

Workflows use `${{ vars.AWS_ROLE_ARN }}` with `permissions: id-token: write`. That is not a password: AWS only accepts a GitHub-signed OIDC token for this repo’s `main` branch. GitHub’s current `sub` claim includes immutable numeric IDs (`repo:Juancho2406@90642323/payment-checkout-fullstack@1348099622:ref:refs/heads/main`); the IAM trust policy allows that form and the legacy name-only form.

PSP private key and integrity secret go in **GitHub Secrets** (`PSP_*`). The SPA public key goes in `VITE_PSP_*`. Never commit them. Never put AWS access keys in Secrets.

Local data plane is still Compose Postgres only (`../docker-compose.yml`).
