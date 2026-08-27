import { fetchCatalog, fetchQuote } from "./api";

const headphones = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 12990000,
  currency: "COP",
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

describe("fetchCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the data array from GET /products", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [headphones] }),
      }),
    );

    await expect(fetchCatalog()).resolves.toEqual([headphones]);
    expect(fetch).toHaveBeenCalledWith("/api/v1/products");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    await expect(fetchCatalog()).rejects.toThrow("No se pudo cargar el catálogo");
  });
});

describe("fetchQuote", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs productId and returns server totals", async () => {
    const quote = {
      productId: headphones.id,
      quantity: 1,
      productAmountCents: 12_990_000,
      baseFeeCents: 111,
      deliveryFeeCents: 222,
      totalCents: 12_990_333,
      currency: "COP" as const,
      stock: 8,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => quote,
      }),
    );

    await expect(fetchQuote(headphones.id, 1)).resolves.toEqual(quote);
    expect(fetch).toHaveBeenCalledWith("/api/v1/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: headphones.id, quantity: 1 }),
    });
  });

  it("maps STOCK_UNAVAILABLE to a Spanish message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: "STOCK_UNAVAILABLE", message: "Requested 1 but only 0 in stock" },
        }),
      }),
    );

    await expect(fetchQuote(headphones.id)).rejects.toThrow("No hay unidades suficientes");
  });
});
