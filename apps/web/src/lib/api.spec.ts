import {
  createCustomer,
  createDelivery,
  createPendingTransaction,
  fetchCatalog,
  fetchQuote,
  getTransaction,
  payTransaction,
  pollTransactionUntilTerminal,
} from "./api";

const headphones = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 12990000,
  currency: "COP",
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

const transaction = {
  id: "tx-1",
  reference: "CHK-1",
  status: "APPROVED" as const,
  productId: headphones.id,
  customerId: "cust-1",
  deliveryId: "del-1",
  quantity: 1,
  productAmountCents: 12_990_000,
  baseFeeCents: 500_000,
  deliveryFeeCents: 800_000,
  totalCents: 14_290_000,
  currency: "COP" as const,
  pspTransactionId: "psp-1",
  cardBrand: "VISA",
  cardLast4: "1111",
};

function jsonResponse(ok: boolean, body: unknown) {
  return { ok, json: async () => body };
}

describe("fetchCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the data array from GET /products", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, { data: [headphones] })));
    await expect(fetchCatalog()).resolves.toEqual([headphones]);
    expect(fetch).toHaveBeenCalledWith("/api/v1/products");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(false, {})));
    await expect(fetchCatalog()).rejects.toThrow("No se pudo cargar el catálogo");
  });

  it("throws when the payload is not a catalog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, { data: "nope" })));
    await expect(fetchCatalog()).rejects.toThrow("formato inesperado");
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, quote)));
    await expect(fetchQuote(headphones.id, 1)).resolves.toEqual(quote);
  });

  it("maps STOCK_UNAVAILABLE to a Spanish message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(false, {
          error: { code: "STOCK_UNAVAILABLE", message: "Requested 1 but only 0 in stock" },
        }),
      ),
    );
    await expect(fetchQuote(headphones.id)).rejects.toThrow("No hay unidades suficientes");
  });

  it("uses the API error message when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(false, { error: { code: "NOT_FOUND", message: "Producto ausente" } }),
      ),
    );
    await expect(fetchQuote(headphones.id)).rejects.toThrow("Producto ausente");
  });

  it("throws when the quote payload is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, { productId: 1 })));
    await expect(fetchQuote(headphones.id)).rejects.toThrow("formato inesperado");
  });
});

describe("checkout commands", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs customer, delivery, transaction and pay", async () => {
    const customer = { id: "c1", fullName: "Ana", email: "a@b.co", phone: "3001112233" };
    const delivery = {
      id: "d1",
      customerId: "c1",
      address: "Cra 7",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
      status: "draft",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(true, customer))
        .mockResolvedValueOnce(jsonResponse(true, delivery))
        .mockResolvedValueOnce(jsonResponse(true, { ...transaction, status: "PENDING" }))
        .mockResolvedValueOnce(jsonResponse(true, transaction)),
    );

    await expect(
      createCustomer({ fullName: "Ana", email: "a@b.co", phone: "3001112233" }),
    ).resolves.toEqual(customer);
    await expect(
      createDelivery({
        customerId: "c1",
        address: "Cra 7",
        city: "Bogotá",
        region: "Cundinamarca",
        postalCode: "110111",
      }),
    ).resolves.toMatchObject({ id: "d1" });
    await expect(
      createPendingTransaction({
        productId: headphones.id,
        quantity: 1,
        customerId: "c1",
        deliveryId: "d1",
      }),
    ).resolves.toMatchObject({ status: "PENDING" });
    await expect(
      payTransaction("tx-1", { paymentToken: "tok", acceptanceToken: "acc" }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("throws the fallback when the payload is not a customer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(true, { id: 1 })));
    await expect(
      createCustomer({ fullName: "Ana", email: "a@b.co", phone: "3001112233" }),
    ).rejects.toThrow("No se pudo guardar el comprador");
  });

  it("GETs a transaction and polls until it leaves PENDING", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(true, { ...transaction, status: "PENDING" }))
        .mockResolvedValueOnce(jsonResponse(true, transaction)),
    );
    await expect(
      pollTransactionUntilTerminal("tx-1", {
        attempts: 3,
        intervalMs: 1,
        sleep: async () => undefined,
      }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("throws when polling stays PENDING", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(true, { ...transaction, status: "PENDING" })),
    );
    await expect(
      pollTransactionUntilTerminal("tx-1", {
        attempts: 1,
        intervalMs: 1,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("no se confirmó a tiempo");
  });

  it("throws when getTransaction fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(false, {})));
    await expect(getTransaction("tx-1")).rejects.toThrow("No se pudo consultar el pago");
  });
});
