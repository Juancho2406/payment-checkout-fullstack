# apps/api

NestJS hexagonal (`@checkout/api`). Health is in-memory; the product catalog is Prisma + Postgres.

```bash
docker compose -f infra/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @checkout/api prisma:migrate
pnpm --filter @checkout/api prisma:seed
pnpm --filter @checkout/api start
```

`GET http://localhost:3001/api/v1/health` → `{ "status": "ok" }`. Swagger: `http://localhost:3001/docs`.

`GET /api/v1/products` lists the seeded catalog (`{ "data": [ { id, name, description, priceCents, currency, stock, imageUrl } ] }`). `GET /api/v1/products/:id` returns one product or `{ "error": { "code": "NOT_FOUND", "message": "…" } }`.

`POST /api/v1/transactions/:id/pay` charges the sandbox PSP (never PAN/CVC). Set `PSP_*` in `.env` for a live sandbox; unit tests use a fake gateway.

Helmet + HSTS + CSP + CORS (origen de la SPA en `:5173`, más `CORS_ORIGINS` en prod).

`pnpm --filter @checkout/api test` corre Jest con umbral de cobertura **80%**.
