# Payment Checkout — FullStack

Kata de checkout: un producto, pago con tarjeta de prueba contra una pasarela **sandbox** (PSP; no se nombra la marca en el código). El trabajo se monta slice a slice (`RM-NN`).

**Links** · Web: `http://localhost:5173` (local) · API: `http://localhost:3001/api/v1` · Swagger: [`http://localhost:3001/docs`](http://localhost:3001/docs) · Cobertura: umbral **80%** en `pnpm --filter @checkout/api test` y `pnpm --filter @checkout/web test` · [Tablero](https://github.com/users/Juancho2406/projects/3)

En `main`, GitHub Actions despliega a AWS (OIDC). La URL HTTPS de CloudFront queda en el resumen del workflow (`SpaUrl`).

## Stack (objetivo)

- **Web:** React + TypeScript + Redux Toolkit + Vite (SPA)
- **API:** NestJS hexagonal (ports & adapters) + ROP
- **DB:** PostgreSQL + Prisma
- **Monorepo:** pnpm workspaces, Node 22
- **Infra:** Docker Compose (Postgres local) · AWS CDK (ECS Fargate + ALB, RDS, S3 + CloudFront). **Sin Lambda.** HTTPS en CloudFront; el ALB queda HTTP detrás del mismo host (`/api/*`).

Hoy hay Nest (catálogo, checkout, cobro) y la SPA de producto en Vite.

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
docker compose -f infra/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @checkout/api prisma:migrate
pnpm --filter @checkout/api prisma:seed
pnpm --filter @checkout/api start
pnpm --filter @checkout/web start
```

`GET http://localhost:3001/api/v1/health` → `{ "status": "ok" }`.
SPA: `http://localhost:5173` (proxy `/api` → Nest en `:3001`). El puerto **3001** evita chocar con otros procesos en `:3000`.
Contrato vivo: [`http://localhost:3001/docs`](http://localhost:3001/docs) (JSON en `/docs-json`).

## CI y deploy

Un workflow (`.github/workflows/ci.yml`):

- En `pull_request` y `push` a `main`: Node desde `.nvmrc`, pnpm vía Corepack, `pnpm install --frozen-lockfile`, y `lint`/`test` de cada workspace **si el script existe**.
- En `push` a `main` (después de que CI pase): OIDC a AWS, `cdk bootstrap`, secreto PSP en Secrets Manager, build de la SPA, y deploy **en orden** con pausas: red → RDS → API Fargate → espera `/api/v1/health` en el ALB → S3+CloudFront → espera health por HTTPS.

## Cómo se cierra un slice

Cada `RM-NN` es un issue. GitHub solo entiende `#<número>`:

```
Closes #7
```

`RM-07` en el mensaje es para humanos; **no** mueve la tarjeta. Detalle: [`backlog/README.md`](backlog/README.md).
