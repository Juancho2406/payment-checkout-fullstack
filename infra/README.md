# infra

Maps 1:1 to `docs/architecture.drawio`.

| Diagram box | This folder |
|---|---|
| PostgreSQL (Docker Compose) | `docker-compose.yml` — **runnable now** |
| VPC, public/private subnets | `cdk/lib/network-stack.ts` — stub |
| ALB + ECS Fargate (`apps/api`) | `cdk/lib/api-stack.ts` — stub |
| RDS PostgreSQL | `cdk/lib/db-stack.ts` — stub |
| CloudFront + S3 (`apps/web`) | `cdk/lib/web-stack.ts` — stub |
| Secrets Manager | noted in db/api stubs; filled on deploy |

**Local:** `docker compose -f infra/docker-compose.yml up -d` then point the API at `DATABASE_URL` from `.env.example`. Nest and Vite are not started here.

**AWS (later):** ECS Fargate behind an ALB, RDS in the private subnet, SPA on S3+CloudFront. **No Lambda.** CDK constructs land when there is an image to deploy.
