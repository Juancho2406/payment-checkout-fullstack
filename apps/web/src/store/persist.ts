import type { CheckoutTransaction } from "../lib/api";
import type {
  CardPreview,
  CheckoutScreen,
  CheckoutState,
  CustomerDraft,
  DeliveryDraft,
} from "../features/checkout/checkoutSlice";
import { initialCheckoutState } from "../features/checkout/checkoutSlice";

export const CHECKOUT_PERSIST_KEY = "checkout.progress";

export type PersistedCheckout = {
  readonly version: 1;
  readonly screen: CheckoutScreen;
  readonly summaryOpen: boolean;
  readonly modalOpen: boolean;
  readonly customer: CustomerDraft | null;
  readonly delivery: DeliveryDraft | null;
  readonly cardPreview: CardPreview | null;
  readonly productId: string | null;
  readonly quantity: number;
  readonly transaction: CheckoutTransaction | null;
};

const SECRET_KEYS = new Set([
  "pan",
  "cvc",
  "number",
  "paymentToken",
  "acceptanceToken",
  "acceptPersonalAuth",
  "cardNumber",
  "expiry",
  "cardholder",
]);

export type PersistableState = {
  readonly product: { readonly item: { readonly id: string } | null };
  readonly checkout: CheckoutState;
};

export function toPersistedCheckout(state: PersistableState): PersistedCheckout {
  const { checkout, product } = state;
  return {
    version: 1,
    screen: checkout.screen,
    summaryOpen: checkout.summaryOpen,
    modalOpen: checkout.modalOpen,
    customer: checkout.customer,
    delivery: checkout.delivery,
    cardPreview: checkout.cardPreview,
    productId:
      product.item?.id ??
      checkout.selectedProductId ??
      checkout.transaction?.productId ??
      checkout.quote?.productId ??
      null,
    quantity: checkout.transaction?.quantity ?? checkout.quote?.quantity ?? 1,
    transaction: checkout.transaction,
  };
}

export function isEmptyProgress(snapshot: PersistedCheckout): boolean {
  return (
    snapshot.screen === "product" &&
    !snapshot.summaryOpen &&
    !snapshot.modalOpen &&
    snapshot.customer === null &&
    snapshot.delivery === null &&
    snapshot.transaction === null
  );
}

export function checkoutFromSnapshot(snapshot: PersistedCheckout): CheckoutState {
  const terminal =
    snapshot.transaction?.status === "APPROVED" ||
    snapshot.transaction?.status === "DECLINED";
  return {
    ...initialCheckoutState,
    screen: snapshot.screen,
    summaryOpen: snapshot.summaryOpen,
    modalOpen: snapshot.modalOpen,
    customer: snapshot.customer,
    delivery: snapshot.delivery,
    cardPreview: snapshot.cardPreview,
    transaction: snapshot.transaction,
    selectedProductId: snapshot.productId,
    paymentStatus: terminal ? "succeeded" : "idle",
  };
}

export function savePersistedCheckout(state: PersistableState): void {
  const snapshot = toPersistedCheckout(state);
  if (isEmptyProgress(snapshot)) {
    localStorage.removeItem(CHECKOUT_PERSIST_KEY);
    return;
  }
  localStorage.setItem(CHECKOUT_PERSIST_KEY, JSON.stringify(snapshot));
}

export function loadPersistedCheckout(): CheckoutState | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_PERSIST_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (containsSecrets(parsed)) {
      localStorage.removeItem(CHECKOUT_PERSIST_KEY);
      return null;
    }
    const snapshot = parseSnapshot(parsed);
    if (!snapshot) {
      localStorage.removeItem(CHECKOUT_PERSIST_KEY);
      return null;
    }
    return checkoutFromSnapshot(snapshot);
  } catch {
    localStorage.removeItem(CHECKOUT_PERSIST_KEY);
    return null;
  }
}

export function containsSecrets(value: unknown): boolean {
  if (typeof value === "string") {
    return /^tok_/i.test(value.trim());
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) {
      return true;
    }
    if (containsSecrets(nested)) {
      return true;
    }
  }
  return false;
}

function parseSnapshot(value: unknown): PersistedCheckout | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (row.version !== 1) {
    return null;
  }
  if (row.screen !== "product" && row.screen !== "status") {
    return null;
  }
  if (typeof row.summaryOpen !== "boolean" || typeof row.modalOpen !== "boolean") {
    return null;
  }
  if (typeof row.quantity !== "number" || !Number.isInteger(row.quantity) || row.quantity < 1) {
    return null;
  }
  const customer = parseCustomer(row.customer);
  const delivery = parseDelivery(row.delivery);
  const cardPreview = parseCardPreview(row.cardPreview);
  const transaction = parseTransaction(row.transaction);
  if (row.customer !== null && !customer) {
    return null;
  }
  if (row.delivery !== null && !delivery) {
    return null;
  }
  if (row.cardPreview !== null && !cardPreview) {
    return null;
  }
  if (row.transaction !== null && !transaction) {
    return null;
  }
  return {
    version: 1,
    screen: row.screen,
    summaryOpen: row.summaryOpen,
    modalOpen: row.modalOpen,
    customer,
    delivery,
    cardPreview,
    productId: row.productId === null || typeof row.productId === "string" ? row.productId : null,
    quantity: row.quantity,
    transaction,
  };
}

function parseCustomer(value: unknown): CustomerDraft | null {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.fullName !== "string" ||
    typeof row.email !== "string" ||
    typeof row.phone !== "string"
  ) {
    return null;
  }
  return { fullName: row.fullName, email: row.email, phone: row.phone };
}

function parseDelivery(value: unknown): DeliveryDraft | null {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.address !== "string" ||
    typeof row.city !== "string" ||
    typeof row.region !== "string" ||
    typeof row.postalCode !== "string"
  ) {
    return null;
  }
  return {
    address: row.address,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
  };
}

function parseCardPreview(value: unknown): CardPreview | null {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (row.brand !== "VISA" && row.brand !== "MASTERCARD") {
    return null;
  }
  if (typeof row.last4 !== "string" || !/^\d{4}$/.test(row.last4)) {
    return null;
  }
  return { brand: row.brand, last4: row.last4 };
}

function parseTransaction(value: unknown): CheckoutTransaction | null {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.reference !== "string" ||
    typeof row.productId !== "string" ||
    (row.status !== "PENDING" &&
      row.status !== "APPROVED" &&
      row.status !== "DECLINED" &&
      row.status !== "ERROR") ||
    typeof row.totalCents !== "number" ||
    row.currency !== "COP"
  ) {
    return null;
  }
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    productId: row.productId,
    customerId: typeof row.customerId === "string" ? row.customerId : "",
    deliveryId: typeof row.deliveryId === "string" ? row.deliveryId : "",
    quantity: typeof row.quantity === "number" ? row.quantity : 1,
    productAmountCents: typeof row.productAmountCents === "number" ? row.productAmountCents : 0,
    baseFeeCents: typeof row.baseFeeCents === "number" ? row.baseFeeCents : 0,
    deliveryFeeCents: typeof row.deliveryFeeCents === "number" ? row.deliveryFeeCents : 0,
    totalCents: row.totalCents,
    currency: "COP",
    pspTransactionId: typeof row.pspTransactionId === "string" ? row.pspTransactionId : null,
    cardBrand: typeof row.cardBrand === "string" ? row.cardBrand : null,
    cardLast4: typeof row.cardLast4 === "string" ? row.cardLast4 : null,
  };
}
