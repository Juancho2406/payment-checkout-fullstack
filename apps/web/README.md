# apps/web

SPA de checkout (`@checkout/web`): React + Redux Toolkit + Vite. Mobile-first (piso: iPhone SE).

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter @checkout/web start
```

`http://localhost:5173` → página de producto (`GET /api/v1/products` vía proxy a Nest en `:3000`). El botón **Pagar con tarjeta de crédito** está en la UI; el modal de tarjeta/entrega es el siguiente slice.

La SPA no tokeniza PAN contra nuestra API.
