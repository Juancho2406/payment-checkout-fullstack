# Payment Checkout — FullStack

Kata de checkout: un producto, pago con tarjeta de prueba contra una pasarela **sandbox** (PSP; no se nombra la marca en el código). El trabajo se monta slice a slice (`RM-NN`).

**Links** · Web: _pendiente_ · API / Swagger: _pendiente_ · Cobertura: _pendiente_ · [Tablero](https://github.com/users/Juancho2406/projects/3)

## Stack (objetivo)

- **Web:** React + TypeScript + Redux Toolkit + Vite (SPA)
- **API:** NestJS hexagonal (ports & adapters) + ROP
- **DB:** PostgreSQL + Prisma
- **Monorepo:** pnpm workspaces, Node 22
- **Infra:** Docker Compose (Postgres local) · AWS CDK (ECS Fargate + ALB, RDS, S3 + CloudFront). **Sin Lambda.**

Hoy hay Nest (health). Vite y Prisma **aún no**.

## Carpetas

| Ruta | Qué es |
|---|---|
| `apps/api` | API HTTP (workspace `@checkout/api`) |
| `apps/web` | SPA de checkout (workspace `@checkout/web`) |
| `infra` | Compose + CDK (`infra/cdk` = `@checkout/infra`) |
| `docs` | Contrato de la kata. Topología: [`docs/architecture.drawio`](docs/architecture.drawio) |
| `backlog` | `roadmap.json` — fuente de verdad de los slices |

## Cómo correrlo (hoy)

```bash
pnpm install
pnpm --filter @checkout/api start
```

`GET http://localhost:3000/api/v1/health` → `{ "status": "ok" }`. Postgres (Compose) no hace falta para health; Vite llega después.

## CI

Un workflow (`.github/workflows/ci.yml`) en `push` y `pull_request` a `main`: Node desde `.nvmrc`, pnpm vía Corepack, `pnpm install --frozen-lockfile`, y `lint`/`test` de cada workspace **si el script existe**.

## Cómo se cierra un slice

Cada `RM-NN` es un issue. GitHub solo entiende `#<número>`:

```
Closes #7
```

`RM-07` en el mensaje es para humanos; **no** mueve la tarjeta. Detalle: [`backlog/README.md`](backlog/README.md).
