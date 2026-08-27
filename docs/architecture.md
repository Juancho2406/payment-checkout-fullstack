# Arquitectura (objetivo)

Contrato de la kata: **SPA de checkout + API hexagonal + PostgreSQL**. El dibujo canónico es [`architecture.drawio`](architecture.drawio). Este markdown explica lo que el diagrama no puede: capas, ROP y qué corre dónde.

**Nest existe desde `RM-10` (health).** Vite y Prisma llegan en slices posteriores. Lo que sigue es la topología y el diseño que se implementan slice a slice. Health no sustituye a products ni payments.

## Dos despliegues, el mismo código

| | Local | AWS |
|---|---|---|
| SPA | Vite en `apps/web` | CloudFront → origen S3 (`apps/web` estático) |
| API | Nest en `apps/api` | CloudFront `/api/*` → ALB HTTP → **ECS Fargate** (misma API hexagonal) |
| DB | Postgres 16 en Compose (`infra/docker-compose.yml`) | RDS PostgreSQL en subred aislada |
| Secretos | env (`.env.example`) | Secrets Manager |
| Logs | stdout | CloudWatch |

**Sin Lambda.** La API es un proceso HTTP largo: orquesta cobro, hace polling del sandbox y escribe stock/entrega. Eso encaja en Fargate, no en un handler de un request. Las stacks CDK (`infra/cdk`) despliegan esa topología desde GitHub Actions (`RM-26`).

Compose **solo** levanta Postgres. Nest y Vite no se arrancan desde `infra/`.

```
Cliente ──SPA──► API hexagonal ──SQL──► PostgreSQL
              │
              ├── (browser, llave pública) tokeniza tarjeta ──► PSP sandbox
              └── (server, llave privada) cobra / consulta estado ──► PSP sandbox
```

El PAN **nunca** entra a Nest. La línea punteada del draw.io es esa: tokenización en el browser.

## Flujo de checkout (los 6 pasos del diagrama)

1. Abrir la SPA del producto (Vite local o CloudFront).
2. Tokenizar la tarjeta en el browser (llave pública del PSP). El PAN no llega a la API.
3. Llamar a la API: Nest local o ALB → Fargate. **El mismo codebase hexagonal.**
4. Caso de uso ROP: crear transacción `PENDING`, reservar stock. La lógica no vive en el controller.
5. Persistir en PostgreSQL (Compose local; RDS en AWS).
6. Cobrar al PSP (llave privada). Si `APPROVED`: entrega + confirmar stock. Si `DECLINED`: devolver reserva.

Cinco pantallas de UI (kata): producto → tarjeta/entrega → resumen (backdrop) → estado final → vuelta al producto con stock actualizado. Un refresh no debe perder el paso; **sí** debe perder PAN/CVC.

## Hexágono (Ports & Adapters)

Tres anillos. Las dependencias apuntan **hacia adentro**.

| Anillo | Qué contiene | Qué no |
|---|---|---|
| **Dominio** | Entidades, invariantes (stock ≥ 0, montos en centavos), **puertos** (interfaces) | Nest, Prisma, HTTP del PSP |
| **Aplicación** | Casos de uso: quote, crear `PENDING`, pagar. Cadenas ROP | Decoradores de controller, SQL |
| **Infraestructura** | Adapters: HTTP Nest, Prisma, cliente PSP, env | Reglas de negocio |

Puertos que importan para esta kata (interfaces del dominio; los adapters llegan después):

- `ProductRepository` — leer producto y stock; persistir reserva/descuento.
- `TransactionRepository` — crear `PENDING`, buscar por `id`/`reference`, actualizar estado. Idempotencia por `reference`.
- `CustomerRepository` / `DeliveryRepository` — persistir cliente y dirección; asignar entrega tras `APPROVED`.
- `PaymentGateway` — **solo** `createCharge` y `getChargeStatus`. No `tokenizeCard`: eso es del browser.

El controller HTTP es un adapter más: valida el shape del request, llama al caso de uso, traduce `Result` a status HTTP. Si el evaluador abre un controller y ve el cobro al PSP, el hexágono está mal.

La API se organiza en `domain` / `application` / `infrastructure` bajo `apps/api/src`. El primer slice (`RM-10`) es health; products y payments no están hasta sus RM.

## Railway Oriented Programming (ROP)

Cada caso de uso devuelve `Result<T, DomainError>` (p. ej. `neverthrow`). Los errores de negocio **no** se lanzan como excepciones de control de flujo.

Cadena del cobro (`POST /transactions/:id/pay`, `RM-17`):

```
loadPending → (idempotente si ya APPROVED/DECLINED)
  → validateTokenAndAcceptance
  → chargePsp
  → pollUntilTerminal
  → si APPROVED: confirmStock + assignDelivery
  → si DECLINED: releaseStock
  → persist status
```

`map` / `andThen` hacia el éxito; `mapErr` hacia un error de dominio (`StockUnavailable`, `AlreadyPaid`, `PspDeclined`, `PspTimeout`). El adapter HTTP mapea eso a 409 / 402 / 503, no a un `catch` genérico 500.

Idempotencia: la `reference` es única hacia el PSP. Un retry del mismo `pay` no cobra dos veces.

## Límites de responsabilidad

| Quién | Dueño de |
|---|---|
| SPA | Pantallas, validación de formato (Luhn, marca), tokenización, persistir paso **sin** PAN |
| API | Totales (fees), stock, máquina de estados de la transacción, firma de integridad, cobro |
| PSP sandbox | Token de tarjeta, aceptación de términos, resultado `APPROVED` / `DECLINED` |
| Postgres | Producto, cliente, entrega, transacción (sin PAN ni token de tarjeta) |

El front **no** inventa el total. `POST /checkout/quote` recalcula producto + base fee (siempre) + delivery fee. Contrato: [`api-contract.md`](api-contract.md). Modelo: [`data-model.md`](data-model.md).

## Qué no es esta arquitectura

- No hay Widget/Checkout embebido del PSP: la kata pide **nuestro** modal y **nuestra** API.
- No hay Lambda, API Gateway ni DynamoDB en la propuesta (aunque el PDF los liste como opciones).
- No hay endpoint para crear productos: seed dummy (`RM-11`).
