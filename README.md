# Payment Checkout — FullStack

Kata de checkout: un producto, pago con tarjeta de prueba contra una pasarela **sandbox** (PSP; no se nombra la marca en el código). El trabajo se monta slice a slice (`RM-NN`).

**Links** · Live: [https://d1ijyiafiowx0e.cloudfront.net](https://d1ijyiafiowx0e.cloudfront.net) · Swagger: [https://d1ijyiafiowx0e.cloudfront.net/docs](https://d1ijyiafiowx0e.cloudfront.net/docs) · Local web: `http://localhost:5173` · Local API: `http://localhost:3001/api/v1` · Cobertura: umbral **80%** · [Tablero](https://github.com/users/Juancho2406/projects/3)

En `main`, GitHub Actions despliega a AWS (OIDC) en este orden: red → RDS → Fargate+ALB → SPA en CloudFront, con pausas y espera de health en CloudFront.

## Stack (objetivo)

- **Web:** React + TypeScript + Redux Toolkit + Vite (SPA)
- **API:** NestJS hexagonal (ports & adapters) + ROP
- **DB:** PostgreSQL + Prisma
- **Monorepo:** pnpm workspaces, Node 22
- **Infra:** Docker Compose (Postgres local) · AWS CDK (ECS Fargate + ALB, RDS, S3 + CloudFront). **HTTPS** en CloudFront; el ALB es HTTP **solo** desde el prefix list origin-facing de CloudFront (`openListener: false`).

Modelo de datos (producto, cliente, transacción, entrega; sin PAN): [`docs/data-model.md`](docs/data-model.md). Esquema Prisma: `apps/api/prisma/schema.prisma`.

Hoy hay Nest (catálogo, checkout, cobro) y la SPA de producto en Vite.

## Tarjetas de prueba (sandbox)

Solo dos PAN tokenizan y cobran en este ambiente. Cualquier otra tarjeta Luhn-válida la rechaza el PSP al tokenizar.

| PAN | Resultado del cobro |
|---|---|
| `4242424242424242` | `APPROVED` |
| `4111111111111111` | `DECLINED` |

Fecha, CVC y titular pueden ser cualquier valor válido (p. ej. `12/29`, `123`, `ANA PEREZ`).

## Carpetas

| Ruta | Qué es |
|---|---|
| `apps/api` | API HTTP (workspace `@checkout/api`) |
| `apps/web` | SPA de checkout (workspace `@checkout/web`) |
| `infra` | Compose + CDK (`infra/cdk` = `@checkout/infra`) |
| `docs` | Contrato de la kata. Topología: [`docs/architecture.drawio`](docs/architecture.drawio). Modelo: [`docs/data-model.md`](docs/data-model.md) |
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
- En `push` a `main` (después de que CI pase): OIDC a AWS, `cdk bootstrap`, secreto PSP en Secrets Manager, build de la SPA, y deploy **en orden** con pausas: red → RDS → API Fargate → espera de targets healthy en el ALB (el listener no es público; CloudFront es el único origen) → S3+CloudFront → espera health por HTTPS.

## Cómo se cierra un slice

Cada `RM-NN` es un issue. GitHub solo entiende `#<número>`:

```
Closes #7
```

`RM-07` en el mensaje es para humanos; **no** mueve la tarjeta. Detalle: [`backlog/README.md`](backlog/README.md).
