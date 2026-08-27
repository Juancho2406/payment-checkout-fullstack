# apps/api

NestJS hexagonal (`@checkout/api`). Primer slice: liveness.

```bash
pnpm --filter @checkout/api start
```

`GET http://localhost:3000/api/v1/health` → `{ "status": "ok" }`. Prisma y el resto de puertos llegan en slices posteriores.
