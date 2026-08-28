import { useEffect } from "react";
import type { CatalogProduct } from "../../lib/api";
import { formatCopFromCents } from "../../lib/money";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { CheckoutModal } from "../checkout/CheckoutModal";
import { openCheckoutModal } from "../checkout/checkoutSlice";
import { SummaryBackdrop } from "../checkout/SummaryBackdrop";
import { loadCatalog, selectProduct } from "./productSlice";

export function ProductPage() {
  const dispatch = useAppDispatch();
  const { status, items, error } = useAppSelector((state) => state.product);
  const modalOpen = useAppSelector((state) => state.checkout.modalOpen);
  const summaryOpen = useAppSelector((state) => state.checkout.summaryOpen);

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

  if (items.length === 0) {
    return (
      <main className="page">
        <p className="muted">No hay productos en el catálogo.</p>
      </main>
    );
  }

  function startCheckout(product: CatalogProduct) {
    dispatch(selectProduct(product.id));
    dispatch(openCheckoutModal());
  }

  return (
    <main className="page">
      <ul className="catalog">
        {items.map((product) => {
          const outOfStock = product.stock < 1;
          return (
            <li key={product.id}>
              <article className="card">
                <img className="card__image" src={product.imageUrl} alt={product.name} />
                <div className="card__body">
                  <p className="eyebrow">Producto</p>
                  <h1 className="card__title">{product.name}</h1>
                  <p className="card__description">{product.description}</p>
                  <p className="card__price">{formatCopFromCents(product.priceCents)}</p>
                  <p className="card__stock">
                    {outOfStock ? "Sin unidades" : `${product.stock} disponibles`}
                  </p>
                  <button
                    type="button"
                    className="button"
                    data-testid={`pay-with-card-${product.id}`}
                    disabled={outOfStock}
                    onClick={() => startCheckout(product)}
                  >
                    Pagar con tarjeta de crédito
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {modalOpen ? <CheckoutModal /> : null}
      {summaryOpen ? <SummaryBackdrop /> : null}
    </main>
  );
}
