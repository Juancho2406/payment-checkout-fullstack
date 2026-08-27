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
  return "No se pudo calcular el total";
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
