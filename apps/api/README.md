# apps/api

NestJS hexagonal (`@checkout/api`). Health is in-memory; the product catalog is Prisma + Postgres.

```bash
docker compose -f infra/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @checkout/api prisma:migrate
pnpm --filter @checkout/api prisma:seed
pnpm --filter @checkout/api start
```

`GET http://localhost:3000/api/v1/health` → `{ "status": "ok" }`. `GET /products` arrives in a later slice.
