import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import type { CatalogProduct, CheckoutQuote, CheckoutTransaction } from "../../lib/api";
import {
  clearBrowserCardSecrets,
  peekCardSession,
  saveCardSession,
} from "../../lib/card-session";
import { tokenizeCard } from "../../lib/psp-tokenize";
import { App } from "../../App";
import { makeStore, testState } from "../../store/store";
import { SummaryBackdrop } from "./SummaryBackdrop";

vi.mock("../../lib/psp-tokenize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/psp-tokenize")>();
  return {
    ...actual,
    tokenizeCard: vi.fn(),
  };
});

const headphones: CatalogProduct = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear Bluetooth con cancelación de ruido. Producto dummy del catálogo.",
  priceCents: 12_990_000,
  currency: "COP",
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

const quoteFromApi: CheckoutQuote = {
  productId: headphones.id,
  quantity: 1,
  productAmountCents: 12_990_000,
  baseFeeCents: 777_000,
  deliveryFeeCents: 333_000,
  totalCents: 14_100_000,
  currency: "COP",
  stock: 8,
};

const approvedTx: CheckoutTransaction = {
  id: "tx-1",
  reference: "CHK-1",
  status: "APPROVED",
  productId: headphones.id,
  customerId: "cust-1",
  deliveryId: "del-1",
  quantity: 1,
  productAmountCents: 12_990_000,
  baseFeeCents: 777_000,
  deliveryFeeCents: 333_000,
  totalCents: 14_100_000,
  currency: "COP",
  pspTransactionId: "psp-1",
  cardBrand: "VISA",
  cardLast4: "1111",
};

function jsonOk(body: unknown) {
  return { ok: true, json: async () => body };
}

function stubCheckoutApi(payStatus: CheckoutTransaction["status"] = "APPROVED") {
  const paid = { ...approvedTx, status: payStatus };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/checkout/quote")) {
        return jsonOk(quoteFromApi);
      }
      if (url.includes("/customers") && method === "POST") {
        return jsonOk({
          id: "cust-1",
          fullName: "Ana Pérez",
          email: "ana@example.com",
          phone: "3001112233",
        });
      }
      if (url.includes("/deliveries") && method === "POST") {
        return jsonOk({
          id: "del-1",
          customerId: "cust-1",
          address: "Cra 7 # 12-34",
          city: "Bogotá",
          region: "Cundinamarca",
          postalCode: "110111",
          status: "draft",
        });
      }
      if (url.includes("/pay")) {
        return jsonOk(paid);
      }
      if (url.endsWith("/transactions") && method === "POST") {
        return jsonOk({ ...approvedTx, status: "PENDING", pspTransactionId: null, cardBrand: null, cardLast4: null });
      }
      if (url.includes("/products")) {
        return jsonOk({ data: [{ ...headphones, stock: 7 }] });
      }
      throw new Error(`unexpected url ${url}`);
    }),
  );
}

function checkoutDraft() {
  return {
    summaryOpen: true as const,
    customer: {
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "3001112233",
    },
    delivery: {
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    },
    cardPreview: { brand: "VISA" as const, last4: "1111" },
  };
}

function renderSummary() {
  const store = makeStore(
    testState({ status: "succeeded", item: headphones, error: null }, checkoutDraft()),
  );
  return {
    store,
    ...render(
      <Provider store={store}>
        <SummaryBackdrop />
      </Provider>,
    ),
  };
}

describe("SummaryBackdrop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearBrowserCardSecrets();
    vi.mocked(tokenizeCard).mockReset();
  });

  it("renders line items from the quote API, not invented fees", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => quoteFromApi,
      }),
    );

    const { store } = renderSummary();

    expect(await screen.findByText("Tarifa base")).toBeInTheDocument();
    expect(screen.getByText(/7[.\s]?770/)).toBeInTheDocument();
    expect(screen.getByText(/3[.\s]?330/)).toBeInTheDocument();
    expect(screen.getByText(/141[.\s]?000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar" })).toBeEnabled();
    expect(JSON.stringify(store.getState())).not.toContain("4111111111111111");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/checkout/quote",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error and retry when quote fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { code: "STOCK_UNAVAILABLE", message: "Requested 1 but only 0 in stock" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSummary();

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay unidades suficientes");
    expect(screen.getByRole("button", { name: "Pagar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("returns to the card modal from Volver", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => quoteFromApi,
      }),
    );
    const user = userEvent.setup();
    const { store } = renderSummary();

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(store.getState().checkout.summaryOpen).toBe(false);
    expect(store.getState().checkout.modalOpen).toBe(true);
  });

  it("tokenizes, charges via our API without PAN, and shows APPROVED", async () => {
    stubCheckoutApi("APPROVED");
    vi.mocked(tokenizeCard).mockResolvedValue({
      paymentToken: "tok_test_visa",
      acceptanceToken: "eyJ-acceptance",
      acceptPersonalAuth: "eyJ-personal",
    });
    saveCardSession({
      pan: "4111111111111111",
      cvc: "123",
      expiry: "12/29",
      cardholder: "ANA PEREZ",
    });

    const store = makeStore(
      testState({ status: "succeeded", item: headphones, error: null }, checkoutDraft()),
    );
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    await screen.findByText("Tarifa base");
    await user.click(screen.getByRole("button", { name: "Pagar" }));

    expect(await screen.findByRole("heading", { name: "Pago aprobado" })).toBeInTheDocument();
    expect(tokenizeCard).toHaveBeenCalled();
    expect(peekCardSession()).toBeNull();
    const snapshot = JSON.stringify(store.getState());
    expect(snapshot).not.toContain("4111111111111111");
    expect(snapshot).not.toContain("tok_test_visa");
    expect(snapshot.toLowerCase()).not.toContain("cvc");
    expect(store.getState().checkout.transaction?.status).toBe("APPROVED");
    const bodies = vi
      .mocked(fetch)
      .mock.calls.map((call) => call[1]?.body)
      .filter((body): body is string => typeof body === "string");
    for (const body of bodies) {
      expect(body).not.toContain("4111111111111111");
      expect(body).not.toContain('"cvc"');
    }
  });
});
