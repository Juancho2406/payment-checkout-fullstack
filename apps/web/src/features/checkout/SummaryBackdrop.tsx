import { useEffect, useId } from "react";
import { clearBrowserCardSecrets } from "../../lib/card-session";
import { formatCopFromCents } from "../../lib/money";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { BrandMark } from "./BrandMark";
import {
  backToCheckoutModal,
  closeSummaryBackdrop,
  loadQuote,
  tokenizePaymentMethod,
} from "./checkoutSlice";

export function SummaryBackdrop() {
  const dispatch = useAppDispatch();
  const titleId = useId();
  const product = useAppSelector((state) => state.product.item);
  const { cardPreview, delivery, quote, quoteStatus, quoteError, tokenizeStatus, tokenizeError } =
    useAppSelector((state) => state.checkout);

  useEffect(() => {
    if (!product) {
      return;
    }
    void dispatch(loadQuote({ productId: product.id, quantity: 1 }));
  }, [dispatch, product]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissSummary();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const canPay =
    quoteStatus === "succeeded" &&
    quote !== null &&
    tokenizeStatus !== "loading" &&
    tokenizeStatus !== "succeeded";

  function dismissSummary() {
    clearBrowserCardSecrets();
    dispatch(closeSummaryBackdrop());
  }

  return (
    <div
      className="modal-backdrop modal-backdrop--summary"
      role="presentation"
      onClick={() => dismissSummary()}
    >
      <div
        className="modal modal--summary"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            Resumen de pago
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={() => dismissSummary()}
          >
            ×
          </button>
        </header>

        {product ? <p className="summary-product">{product.name}</p> : null}
        {cardPreview ? (
          <p className="summary-meta">
            <BrandMark brand={cardPreview.brand} />
            <span>•••• {cardPreview.last4}</span>
          </p>
        ) : null}
        {delivery ? (
          <p className="summary-meta muted">
            {delivery.address}, {delivery.city}
          </p>
        ) : null}

        {quoteStatus === "loading" || quoteStatus === "idle" ? (
          <p className="muted">Calculando total…</p>
        ) : null}

        {quoteStatus === "failed" ? (
          <div>
            <p className="error" role="alert">
              {quoteError}
            </p>
            <button
              type="button"
              className="button"
              disabled={!product}
              onClick={() => {
                if (product) {
                  void dispatch(loadQuote({ productId: product.id, quantity: 1 }));
                }
              }}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {quote ? (
          <dl className="summary-lines">
            <div className="summary-line">
              <dt>Producto</dt>
              <dd>{formatCopFromCents(quote.productAmountCents)}</dd>
            </div>
            <div className="summary-line">
              <dt>Tarifa base</dt>
              <dd>{formatCopFromCents(quote.baseFeeCents)}</dd>
            </div>
            <div className="summary-line">
              <dt>Envío</dt>
              <dd>{formatCopFromCents(quote.deliveryFeeCents)}</dd>
            </div>
            <div className="summary-line summary-line--total">
              <dt>Total</dt>
              <dd>{formatCopFromCents(quote.totalCents)}</dd>
            </div>
          </dl>
        ) : null}

        {tokenizeError ? (
          <p className="error" role="alert">
            {tokenizeError}
          </p>
        ) : null}

        <div className="summary-actions">
          <button
            type="button"
            className="button"
            data-testid="confirm-pay"
            disabled={!canPay}
            onClick={() => void dispatch(tokenizePaymentMethod())}
          >
            {tokenizeStatus === "loading"
              ? "Tokenizando…"
              : tokenizeStatus === "succeeded"
                ? "Tarjeta tokenizada"
                : "Pagar"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => dispatch(backToCheckoutModal())}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
