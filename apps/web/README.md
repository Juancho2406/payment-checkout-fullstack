# apps/web

SPA de checkout (`@checkout/web`): React + Redux Toolkit + Vite. Mobile-first (piso: iPhone SE).

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter @checkout/web start
```

`http://localhost:5173` → producto → modal → resumen (`POST /checkout/quote`) → **Pagar** tokeniza en el browser y cobra vía nuestra API. Luego ves APPROVED/DECLINED y **Volver al producto** recarga el stock.

Copia `apps/web/.env.example` y rellena `VITE_PSP_BASE_URL` + `VITE_PSP_PUBLIC_KEY` para tokenizar contra el sandbox. El PAN nunca llega a Nest.
