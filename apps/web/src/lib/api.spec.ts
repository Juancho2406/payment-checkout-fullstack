import { fetchCatalog } from "./api";

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
