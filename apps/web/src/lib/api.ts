export type CatalogProduct = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly currency: "COP";
  readonly stock: number;
  readonly imageUrl: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function fetchCatalog(): Promise<readonly CatalogProduct[]> {
  const response = await fetch(`${apiBase}/products`);
  if (!response.ok) {
    throw new Error(
      "No se pudo cargar el catálogo. Arranca la API (Nest en :3001) y Postgres.",
    );
  }
  const body: unknown = await response.json();
  if (!isCatalogResponse(body)) {
    throw new Error("El catálogo tiene un formato inesperado");
  }
  return body.data;
}

function isCatalogResponse(
  value: unknown,
): value is { data: CatalogProduct[] } {
  if (!value || typeof value !== "object" || !("data" in value)) {
    return false;
  }
  const data = (value as { data: unknown }).data;
  return Array.isArray(data) && data.every(isCatalogProduct);
}

function isCatalogProduct(value: unknown): value is CatalogProduct {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.description === "string" &&
    typeof row.priceCents === "number" &&
    row.currency === "COP" &&
    typeof row.stock === "number" &&
    typeof row.imageUrl === "string"
  );
}

export type CheckoutQuote = {
  readonly productId: string;
  readonly quantity: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
  readonly currency: "COP";
  readonly stock: number;
};

export async function fetchQuote(
  productId: string,
  quantity = 1,
): Promise<CheckoutQuote> {
  const response = await fetch(`${apiBase}/checkout/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, quantity }),
  });
  if (!response.ok) {
    throw new Error(await quoteErrorMessage(response));
  }
  const body: unknown = await response.json();
  if (!isCheckoutQuote(body)) {
    throw new Error("La cotización tiene un formato inesperado");
  }
  return body;
}

async function quoteErrorMessage(response: Response): Promise<string> {
  return readApiError(response, "No se pudo calcular el total");
}

function isCheckoutQuote(value: unknown): value is CheckoutQuote {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.productId === "string" &&
    typeof row.quantity === "number" &&
    typeof row.productAmountCents === "number" &&
    typeof row.baseFeeCents === "number" &&
    typeof row.deliveryFeeCents === "number" &&
    typeof row.totalCents === "number" &&
    row.currency === "COP" &&
    typeof row.stock === "number"
  );
}

export type CustomerRecord = {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
};

export type DeliveryRecord = {
  readonly id: string;
  readonly customerId: string;
  readonly address: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly status: string;
};

export type TransactionStatus = "PENDING" | "APPROVED" | "DECLINED" | "ERROR";

export type CheckoutTransaction = {
  readonly id: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly productId: string;
  readonly customerId: string;
  readonly deliveryId: string;
  readonly quantity: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
  readonly currency: "COP";
  readonly pspTransactionId: string | null;
  readonly cardBrand: string | null;
  readonly cardLast4: string | null;
};

export async function createCustomer(input: {
  fullName: string;
  email: string;
  phone: string;
}): Promise<CustomerRecord> {
  return postJson("/customers", input, isCustomerRecord, "No se pudo guardar el comprador");
}

export async function createDelivery(input: {
  customerId: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
}): Promise<DeliveryRecord> {
  return postJson("/deliveries", input, isDeliveryRecord, "No se pudo guardar la entrega");
}

export async function createPendingTransaction(input: {
  productId: string;
  quantity: number;
  customerId: string;
  deliveryId: string;
}): Promise<CheckoutTransaction> {
  return postJson(
    "/transactions",
    input,
    isCheckoutTransaction,
    "No se pudo crear la transacción",
  );
}

export async function payTransaction(
  transactionId: string,
  input: {
    paymentToken: string;
    acceptanceToken: string;
    acceptPersonalAuth?: string;
    installments?: number;
  },
): Promise<CheckoutTransaction> {
  return postJson(
    `/transactions/${encodeURIComponent(transactionId)}/pay`,
    input,
    isCheckoutTransaction,
    "No se pudo cobrar",
  );
}

export async function getTransaction(transactionId: string): Promise<CheckoutTransaction> {
  const response = await fetch(
    `${apiBase}/transactions/${encodeURIComponent(transactionId)}`,
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "No se pudo consultar el pago"));
  }
  const body: unknown = await response.json();
  if (!isCheckoutTransaction(body)) {
    throw new Error("La transacción tiene un formato inesperado");
  }
  return body;
}

export async function pollTransactionUntilTerminal(
  transactionId: string,
  options?: {
    attempts?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<CheckoutTransaction> {
  const attempts = options?.attempts ?? 15;
  const intervalMs = options?.intervalMs ?? 1000;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last = await getTransaction(transactionId);
  for (let attempt = 0; attempt < attempts && last.status === "PENDING"; attempt += 1) {
    await sleep(intervalMs);
    last = await getTransaction(transactionId);
  }
  if (last.status === "PENDING") {
    throw new Error("El pago no se confirmó a tiempo");
  }
  return last;
}

async function postJson<T>(
  path: string,
  body: unknown,
  guard: (value: unknown) => value is T,
  fallback: string,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, fallback));
  }
  const payload: unknown = await response.json();
  if (!guard(payload)) {
    throw new Error(fallback);
  }
  return payload;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error?: { code?: unknown; message?: unknown } }).error;
      if (error?.code === "STOCK_UNAVAILABLE") {
        return "No hay unidades suficientes";
      }
      if (typeof error?.message === "string" && error.message.length > 0) {
        return error.message;
      }
    }
  } catch {
    // fall through
  }
  return fallback;
}

function isCustomerRecord(value: unknown): value is CustomerRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.fullName === "string" &&
    typeof row.email === "string" &&
    typeof row.phone === "string"
  );
}

function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.customerId === "string";
}

function isCheckoutTransaction(value: unknown): value is CheckoutTransaction {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.reference === "string" &&
    (row.status === "PENDING" ||
      row.status === "APPROVED" ||
      row.status === "DECLINED" ||
      row.status === "ERROR") &&
    typeof row.totalCents === "number" &&
    row.currency === "COP"
  );
}
