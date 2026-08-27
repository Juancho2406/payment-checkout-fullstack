# Payment Checkout — FullStack

Kata de checkout: un producto, pago con tarjeta de prueba contra una pasarela **sandbox** (PSP; no se nombra la marca en el código). El trabajo se monta slice a slice (`RM-NN`).

**Links** · Web: _pendiente_ · API / Swagger: _pendiente_ · Cobertura: _pendiente_ · [Tablero](https://github.com/users/Juancho2406/projects/3)

## Stack (objetivo)

- **Web:** React + TypeScript + Redux Toolkit + Vite (SPA)
- **API:** NestJS hexagonal (ports & adapters) + ROP
- **DB:** PostgreSQL + Prisma
- **Monorepo:** pnpm workspaces, Node 22
- **Infra:** Docker Compose (Postgres local) · AWS CDK (ECS Fargate + ALB, RDS, S3 + CloudFront). **Sin Lambda.**

Hoy hay empaquetado e infra esqueleto. Nest, Vite y Prisma **aún no** están en el repo.

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
```

Eso instala workspaces y levanta Postgres. **No hay `pnpm dev`:** la API y la SPA no arrancan todavía.

## Cómo se cierra un slice

Cada `RM-NN` es un issue. GitHub solo entiende `#<número>`:

```
Closes #7
```

`RM-07` en el mensaje es para humanos; **no** mueve la tarjeta. Detalle: [`backlog/README.md`](backlog/README.md).
