import { PRODUCT_CURRENCY, type Product } from "./product";

/** Fixed per checkout — never taken from the client. Matches docs/api-contract.md. */
export const BASE_FEE_CENTS = 500_000;
export const DELIVERY_FEE_CENTS = 800_000;

export type CheckoutQuote = {
  readonly productId: string;
  readonly quantity: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
  readonly currency: typeof PRODUCT_CURRENCY;
  readonly stock: number;
};

export type InvalidQuantityError = {
  readonly code: "INVALID_QUANTITY";
  readonly message: string;
};

export type StockUnavailableError = {
  readonly code: "STOCK_UNAVAILABLE";
  readonly message: string;
};

export function invalidQuantity(quantity: unknown): InvalidQuantityError {
  return {
    code: "INVALID_QUANTITY",
    message: `Quantity must be an integer >= 1 (received ${String(quantity)})`,
  };
}

export function stockUnavailable(
  requested: number,
  stock: number,
): StockUnavailableError {
  return {
    code: "STOCK_UNAVAILABLE",
    message: `Requested ${requested} but only ${stock} in stock`,
  };
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function computeQuote(product: Product, quantity: number): CheckoutQuote {
  const productAmountCents = product.priceCents * quantity;
  const baseFeeCents = BASE_FEE_CENTS;
  const deliveryFeeCents = DELIVERY_FEE_CENTS;
  return {
    productId: product.id,
    quantity,
    productAmountCents,
    baseFeeCents,
    deliveryFeeCents,
    totalCents: productAmountCents + baseFeeCents + deliveryFeeCents,
    currency: PRODUCT_CURRENCY,
    stock: product.stock,
  };
}
