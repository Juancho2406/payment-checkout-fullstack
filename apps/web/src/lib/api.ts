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
