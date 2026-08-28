import { loadCatalog, productReducer, selectProduct } from "./productSlice";

const headphones = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 12990000,
  currency: "COP" as const,
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

const keyboard = {
  id: "b09a9b63-1b5b-42a4-9824-973de095f259",
  name: "Teclado mecánico",
  description: "Switch táctil, layout español.",
  priceCents: 24990000,
  currency: "COP" as const,
  stock: 4,
  imageUrl: "https://example.com/keyboard.jpg",
};

describe("productSlice", () => {
  it("stores the full catalog and selects the first product on success", () => {
    const state = productReducer(
      undefined,
      loadCatalog.fulfilled([headphones, keyboard], "req-1"),
    );

    expect(state).toEqual({
      status: "succeeded",
      items: [headphones, keyboard],
      item: headphones,
      error: null,
    });
  });

  it("keeps the previously selected product after a catalog refresh", () => {
    const selected = productReducer(
      {
        status: "succeeded",
        items: [headphones, keyboard],
        item: keyboard,
        error: null,
      },
      loadCatalog.fulfilled(
        [
          { ...headphones, stock: 7 },
          { ...keyboard, stock: 3 },
        ],
        "req-refresh",
      ),
    );

    expect(selected.item).toEqual({ ...keyboard, stock: 3 });
    expect(selected.items).toHaveLength(2);
  });

  it("selects a catalog product by id", () => {
    const loaded = productReducer(
      undefined,
      loadCatalog.fulfilled([headphones, keyboard], "req-1"),
    );
    const state = productReducer(loaded, selectProduct(keyboard.id));
    expect(state.item).toEqual(keyboard);
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
      { status: "succeeded", items: [headphones], item: headphones, error: null },
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
