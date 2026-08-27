# apps/web

SPA de checkout (`@checkout/web`): React + Redux Toolkit + Vite. Mobile-first (piso: iPhone SE).

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter @checkout/web start
```

`http://localhost:5173` → página de producto (`GET /api/v1/products` vía proxy a Nest en `:3001`). **Pagar con tarjeta de crédito** abre el modal; **Continuar** pide `POST /checkout/quote` y muestra el resumen. **Pagar** tokeniza en el browser (llave pública del PSP). El PAN y el CVC nunca van a nuestra API ni a Redux.

Copia `apps/web/.env.example` y rellena `VITE_PSP_BASE_URL` + `VITE_PSP_PUBLIC_KEY` para tokenizar contra el sandbox.
