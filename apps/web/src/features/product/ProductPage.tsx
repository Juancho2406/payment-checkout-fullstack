import { useEffect } from "react";
import { formatCopFromCents } from "../../lib/money";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { CheckoutModal } from "../checkout/CheckoutModal";
import { openCheckoutModal } from "../checkout/checkoutSlice";
import { loadCatalog } from "./productSlice";

export function ProductPage() {
  const dispatch = useAppDispatch();
  const { status, item, error } = useAppSelector((state) => state.product);
  const modalOpen = useAppSelector((state) => state.checkout.modalOpen);

  useEffect(() => {
    if (status === "idle") {
      void dispatch(loadCatalog());
    }
  }, [dispatch, status]);

  if (status === "idle" || status === "loading") {
    return (
      <main className="page" aria-busy="true">
        <p className="muted">Cargando producto…</p>
      </main>
    );
  }

  if (status === "failed") {
    return (
      <main className="page">
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="button" onClick={() => void dispatch(loadCatalog())}>
          Reintentar
        </button>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="page">
        <p className="muted">No hay productos en el catálogo.</p>
      </main>
    );
  }

  const outOfStock = item.stock < 1;

  return (
    <main className="page">
      <article className="card">
        <img className="card__image" src={item.imageUrl} alt={item.name} />
        <div className="card__body">
          <p className="eyebrow">Producto</p>
          <h1 className="card__title">{item.name}</h1>
          <p className="card__description">{item.description}</p>
          <p className="card__price">{formatCopFromCents(item.priceCents)}</p>
          <p className="card__stock">
            {outOfStock ? "Sin unidades" : `${item.stock} disponibles`}
          </p>
          <button
            type="button"
            className="button"
            data-testid="pay-with-card"
            disabled={outOfStock}
            onClick={() => dispatch(openCheckoutModal())}
          >
            Pagar con tarjeta de crédito
          </button>
        </div>
      </article>
      {modalOpen ? <CheckoutModal /> : null}
    </main>
  );
}
