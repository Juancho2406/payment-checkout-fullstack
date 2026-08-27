import { loadCatalog, productReducer } from "./productSlice";

const headphones = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 12990000,
  currency: "COP" as const,
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

describe("productSlice", () => {
  it("stores the first catalog product on success", () => {
    const state = productReducer(
      undefined,
      loadCatalog.fulfilled(headphones, "req-1"),
    );

    expect(state).toEqual({
      status: "succeeded",
      item: headphones,
      error: null,
    });
  });

  it("marks the slice as failed when the thunk rejects", () => {
    const state = productReducer(
      undefined,
      loadCatalog.rejected(new Error("No se pudo cargar el catálogo"), "req-2"),
    );

    expect(state.status).toBe("failed");
    expect(state.error).toBe("No se pudo cargar el catálogo");
  });

  it("uses a fallback error message and keeps succeeded while refreshing", () => {
    const pendingFromIdle = productReducer(undefined, loadCatalog.pending("req-3"));
    expect(pendingFromIdle.status).toBe("loading");

    const pendingFromSuccess = productReducer(
      { status: "succeeded", item: headphones, error: null },
      loadCatalog.pending("req-4"),
    );
    expect(pendingFromSuccess.status).toBe("succeeded");

    const rejected = productReducer(undefined, {
      type: loadCatalog.rejected.type,
      error: {},
    });
    expect(rejected.error).toBe("No se pudo cargar el producto");
  });
});
