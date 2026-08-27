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
