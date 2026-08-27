# Contrato HTTP (objetivo)

REST que la SPA va a consumir. Prefijo `/api/v1`. JSON. Montos en **centavos** (`COP`).

Health está en `RM-10`. El resto de endpoints, en los slices que se indican. Swagger público (`/docs`) es `RM-24`. Hasta entonces este markdown es la fuente de verdad.

Autenticación de usuario: no hay. La API es de un checkout anónimo. Las llaves del PSP no se exponen: la pública puede ir al browser; la privada y el *integrity secret* solo viven en el servidor.

## Convenciones

| | |
|---|---|
| Base local | `http://localhost:<api-port>/api/v1` |
| Base AWS | `https://<alb>/api/v1` |
| Errores | `{ "error": { "code": "STOCK_UNAVAILABLE", "message": "…" } }` |
| Idempotencia | `reference` única en transacciones; `POST …/pay` repetido devuelve el estado ya persistido |

Códigos de error de dominio (ROP → HTTP):

| `code` | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body inválido |
| `NOT_FOUND` | 404 | Producto / transacción / cliente |
| `STOCK_UNAVAILABLE` | 409 | Sin unidades o reserva perdida |
| `ALREADY_PAID` | 409 | `pay` sobre `APPROVED`/`DECLINED` (respuesta idempotente, no re-cobra) |
| `PSP_DECLINED` | 402 | Sandbox rechazó (también 200 con `status: DECLINED` si el cobro sí se ejecutó) |
| `PSP_TIMEOUT` | 503 | Polling agotado; transacción `ERROR`, reintentable |
| `CONFLICT` | 409 | `reference` duplicada |

`PSP_DECLINED`: si el cargo **sí** llegó a terminal `DECLINED`, la API responde **200** con el recurso. 402 queda para “no se pudo iniciar el cobro”.

---

## Health (`RM-10`)

### `GET /health`

Liveness. No toca Postgres todavía (el puerto hexagonal puede devolver `{ "status": "ok" }`). Más adelante puede incluir readiness de DB.

```http
GET /api/v1/health
```

```json
{ "status": "ok" }
```

`200`

---

## Products — no implementado (`RM-12`)

No hay `POST /products`. El catálogo sale del seed (`RM-11`).

### `GET /products`

Lista para la página de producto.

```http
GET /api/v1/products
```

```json
{
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Auriculares inalámbricos",
      "description": "Over-ear, 30 h de batería",
      "priceCents": 19900000,
      "currency": "COP",
      "stock": 7,
      "imageUrl": "https://…"
    }
  ]
}
```

`200`

### `GET /products/{id}`

Detalle + stock actual (la SPA vuelve aquí tras el pago).

`200` · `404 NOT_FOUND`

---

## Checkout quote — no implementado (`RM-13`)

### `POST /checkout/quote`

El servidor recalcula fees. El front **no** es dueño del total.

```http
POST /api/v1/checkout/quote
Content-Type: application/json
```

```json
{
  "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "quantity": 1
}
```

```json
{
  "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "quantity": 1,
  "productAmountCents": 19900000,
  "baseFeeCents": 500000,
  "deliveryFeeCents": 800000,
  "totalCents": 21200000,
  "currency": "COP",
  "stock": 7
}
```

Validaciones: `quantity >= 1`, producto existe, `quantity <= stock` (si no, `409 STOCK_UNAVAILABLE`).

`200` · `400` · `404` · `409`

---

## Customers — no implementado (`RM-14`)

### `POST /customers`

Persiste comprador (antes o junto al primer checkout).

```json
{
  "fullName": "Ana Pérez",
  "email": "ana@example.com",
  "phone": "+573001112233"
}
```

`201` `{ "id": "…", "fullName": "…", "email": "…", "phone": "…" }`

Validar email y teléfono. Upsert por email es aceptable (mismo cliente en dos intentos).

### `GET /customers/{id}`

Para recuperar progreso tras refresh. **No** devuelve PAN ni tokens.

`200` · `404`

---

## Deliveries — no implementado (`RM-14`)

### `POST /deliveries`

Dirección de envío. Obligatoria **antes** de `pay` (la kata asigna la entrega solo si el pago termina bien; la dirección sí se puede guardar antes).

```json
{
  "customerId": "…",
  "address": "Cra 7 # 12-34",
  "city": "Bogotá",
  "region": "Cundinamarca",
  "postalCode": "110111"
}
```

`201` `{ "id": "…", "customerId": "…", "status": "draft", … }`

`status`: `draft` al crear · `assigned` cuando la transacción pasa a `APPROVED`.

### `GET /deliveries/{id}`

`200` · `404`

---

## Transactions — no implementado (`RM-15`, `RM-17`)

### `POST /transactions` — `RM-15`

Crea `PENDING`, **reserva** stock, devuelve `reference`. Aún **no** llama al PSP.

```json
{
  "productId": "…",
  "quantity": 1,
  "customerId": "…",
  "deliveryId": "…"
}
```

Opcional: `reference` del client; si falta, la API genera una (única).

```json
{
  "id": "…",
  "reference": "CHK-20260827-AB12CD",
  "status": "PENDING",
  "productId": "…",
  "customerId": "…",
  "deliveryId": "…",
  "quantity": 1,
  "productAmountCents": 19900000,
  "baseFeeCents": 500000,
  "deliveryFeeCents": 800000,
  "totalCents": 21200000,
  "currency": "COP"
}
```

Totales = mismo cálculo que `/checkout/quote` (no se confía en un total del body).

`201` · `400` · `404` · `409 STOCK_UNAVAILABLE`

### `POST /transactions/{id}/pay` — `RM-17`

Orquestación ROP. Recibe lo que el browser obtuvo del PSP; **nunca** el PAN.

```json
{
  "paymentToken": "tok_test_…",
  "acceptanceToken": "eyJ…",
  "acceptPersonalAuth": "eyJ…",
  "installments": 1
}
```

`acceptPersonalAuth` si el sandbox lo exige junto al token de términos.

La API:

1. Carga la transacción `PENDING` (si ya es terminal → idempotente, no re-cobra).
2. Firma integridad con el secreto del servidor.
3. `createCharge` al PSP (llave privada): `amount_in_cents`, `COP`, `customer_email`, `payment_method.token`, `reference`, `acceptance_token`.
4. Poll `getChargeStatus` hasta `APPROVED` / `DECLINED` o timeout.
5. Persiste resultado; confirma o libera stock; asigna entrega si aprobó.

```json
{
  "id": "…",
  "reference": "CHK-20260827-AB12CD",
  "status": "APPROVED",
  "pspTransactionId": "…",
  "cardBrand": "VISA",
  "cardLast4": "4242",
  "deliveryId": "…",
  "totalCents": 21200000,
  "currency": "COP"
}
```

`200` (terminal o `PENDING` intermedio si el poll aún no cierra) · `400` · `404` · `409` · `503`

La SPA puede hacer polling con `GET` si el `pay` devolvió `PENDING`/`ERROR`.

### `GET /transactions/{id}` — `RM-15` / `RM-17`

Estado para la pantalla final y para sobrevivir un refresh.

`200` el mismo shape que `pay` (sin tokens). `404`

No se listan transacciones. No se borra.

---

## Fuera de este contrato

| Recurso | Por qué no |
|---|---|
| `POST /products` | Seed, no CRUD de catálogo |
| Tokenizar tarjeta (`POST` a *nuestro* API con PAN) | PCI: el browser habla con el PSP (llave pública) |
| Webhooks del PSP | El MVP hace poll desde el caso de uso; eventos quedan fuera |
| Auth de usuario / JWT | Checkout anónimo |

Los endpoints del **PSP** (`GET /merchants/{pubKey}`, `POST /tokens/cards`, `POST /transactions`) no son de esta API. El adapter `PaymentGateway` es el único que usa la llave privada.
