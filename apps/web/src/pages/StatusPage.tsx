import { formatCopFromCents } from "../lib/money";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetCheckout } from "../features/checkout/checkoutSlice";
import { loadCatalog } from "../features/product/productSlice";

export function StatusPage() {
  const dispatch = useAppDispatch();
  const transaction = useAppSelector((state) => state.checkout.transaction);

  if (!transaction) {
    return (
      <main className="page">
        <p className="muted">No hay un pago para mostrar.</p>
        <button type="button" className="button" onClick={() => dispatch(resetCheckout())}>
          Volver al producto
        </button>
      </main>
    );
  }

  const approved = transaction.status === "APPROVED";
  const declined = transaction.status === "DECLINED";
  const title = approved
    ? "Pago aprobado"
    : declined
      ? "Pago rechazado"
      : "No se pudo completar el pago";

  async function backToProduct() {
    await dispatch(loadCatalog());
    dispatch(resetCheckout());
  }

  return (
    <main className="page">
      <article className="card status-card">
        <div className="card__body">
          <p className={`status-eyebrow ${approved ? "status-eyebrow--ok" : "status-eyebrow--bad"}`}>
            {transaction.status}
          </p>
          <h1 className="card__title">{title}</h1>
          <p className="muted">Referencia {transaction.reference}</p>
          <p className="card__price">{formatCopFromCents(transaction.totalCents)}</p>
          {transaction.cardLast4 ? (
            <p className="muted">
              {transaction.cardBrand ?? "Tarjeta"} •••• {transaction.cardLast4}
            </p>
          ) : null}
          <button type="button" className="button" onClick={() => void backToProduct()}>
            Volver al producto
          </button>
        </div>
      </article>
    </main>
  );
}
