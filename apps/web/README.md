# apps/web

SPA de checkout (`@checkout/web`): React + Redux Toolkit + Vite. Mobile-first (piso: iPhone SE).

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter @checkout/web start
```

`http://localhost:5173` → página de producto (`GET /api/v1/products` vía proxy a Nest en `:3001`). **Pagar con tarjeta de crédito** abre el modal; **Continuar** pide `POST /checkout/quote` y muestra el resumen (producto + tarifa base + envío). El PAN y el CVC viven en estado local del modal, no en Redux.

La SPA no tokeniza PAN contra nuestra API.
