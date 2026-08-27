# apps/api

NestJS hexagonal (`@checkout/api`). Health is in-memory; the product catalog is Prisma + Postgres.

```bash
docker compose -f infra/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @checkout/api prisma:migrate
pnpm --filter @checkout/api prisma:seed
pnpm --filter @checkout/api start
```

`GET http://localhost:3000/api/v1/health` → `{ "status": "ok" }`.

`GET /api/v1/products` lists the seeded catalog (`{ "data": [ { id, name, description, priceCents, currency, stock, imageUrl } ] }`). `GET /api/v1/products/:id` returns one product or `{ "error": { "code": "NOT_FOUND", "message": "…" } }`.
