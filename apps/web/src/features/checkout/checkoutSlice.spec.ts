import {
  createCustomer,
  createDelivery,
  createPendingTransaction,
  fetchQuote,
  payTransaction,
  pollTransactionUntilTerminal,
  type CatalogProduct,
  type CheckoutQuote,
  type CheckoutTransaction,
} from "../../lib/api";
import { saveCardSession } from "../../lib/card-session";
import { tokenizeCard } from "../../lib/psp-tokenize";
import { makeStore, testState } from "../../store/store";
import {
  backToCheckoutModal,
  checkoutReducer,
  closeCheckoutModal,
  closeSummaryBackdrop,
  confirmPayment,
  initialCheckoutState,
  loadQuote,
  openCheckoutModal,
  resetCheckout,
  saveCheckoutDraft,
} from "./checkoutSlice";

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    fetchQuote: vi.fn(),
    createCustomer: vi.fn(),
    createDelivery: vi.fn(),
    createPendingTransaction: vi.fn(),
    payTransaction: vi.fn(),
    pollTransactionUntilTerminal: vi.fn(),
  };
});

vi.mock("../../lib/psp-tokenize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/psp-tokenize")>();
  return {
    ...actual,
    tokenizeCard: vi.fn(),
  };
});

const headphones: CatalogProduct = {
  id: "prod-1",
  name: "Auriculares",
  description: "x",
  priceCents: 12_990_000,
  currency: "COP",
  stock: 8,
  imageUrl: "",
};

const quote: CheckoutQuote = {
  productId: headphones.id,
  quantity: 1,
  productAmountCents: 12_990_000,
  baseFeeCents: 500_000,
  deliveryFeeCents: 800_000,
  totalCents: 14_290_000,
  currency: "COP",
  stock: 8,
};

const paid: CheckoutTransaction = {
  id: "tx-1",
  reference: "CHK-1",
  status: "APPROVED",
  productId: headphones.id,
  customerId: "c1",
  deliveryId: "d1",
  quantity: 1,
  productAmountCents: 12_990_000,
  baseFeeCents: 500_000,
  deliveryFeeCents: 800_000,
  totalCents: 14_290_000,
  currency: "COP",
  pspTransactionId: "psp-1",
  cardBrand: "VISA",
  cardLast4: "1111",
};

const draft = {
  customer: { fullName: "Ana Pérez", email: "ana@example.com", phone: "3001112233" },
  delivery: {
    address: "Cra 7 # 12-34",
    city: "Bogotá",
    region: "Cundinamarca",
    postalCode: "110111",
  },
  cardPreview: { brand: "VISA" as const, last4: "1111" },
};

describe("checkoutSlice reducers", () => {
  it("stores brand and last4 and never the PAN", () => {
    const pan = "4111111111111111";
    const state = checkoutReducer(initialCheckoutState, saveCheckoutDraft(draft));
    expect(state.cardPreview).toEqual({ brand: "VISA", last4: "1111" });
    expect(JSON.stringify(state)).not.toContain(pan);
    expect(JSON.stringify(state)).not.toContain("cvc");
    expect(state.modalOpen).toBe(false);
    expect(state.summaryOpen).toBe(true);
  });

  it("opens and closes the modal and summary", () => {
    let state = checkoutReducer(initialCheckoutState, openCheckoutModal());
    expect(state.modalOpen).toBe(true);
    state = checkoutReducer(state, closeCheckoutModal());
    expect(state.modalOpen).toBe(false);
    state = checkoutReducer(
      { ...state, summaryOpen: true, paymentStatus: "failed", paymentError: "x" },
      backToCheckoutModal(),
    );
    expect(state.modalOpen).toBe(true);
    expect(state.summaryOpen).toBe(false);
    expect(state.paymentStatus).toBe("idle");
    state = checkoutReducer({ ...state, summaryOpen: true }, closeSummaryBackdrop());
    expect(state.summaryOpen).toBe(false);
    expect(checkoutReducer(state, resetCheckout())).toEqual(initialCheckoutState);
  });

  it("tracks quote and payment extra reducers", () => {
    let state = checkoutReducer(initialCheckoutState, { type: loadQuote.pending.type });
    expect(state.quoteStatus).toBe("loading");
    state = checkoutReducer(state, { type: loadQuote.fulfilled.type, payload: quote });
    expect(state.quote).toEqual(quote);
    state = checkoutReducer(state, {
      type: loadQuote.rejected.type,
      error: { message: "boom" },
    });
    expect(state.quoteStatus).toBe("failed");
    expect(state.quoteError).toBe("boom");

    state = checkoutReducer(state, { type: confirmPayment.pending.type });
    expect(state.paymentStatus).toBe("paying");
    state = checkoutReducer(state, { type: confirmPayment.fulfilled.type, payload: paid });
    expect(state.screen).toBe("status");
    expect(state.transaction?.id).toBe("tx-1");
    state = checkoutReducer(state, {
      type: confirmPayment.rejected.type,
      error: {},
    });
    expect(state.paymentStatus).toBe("failed");
    expect(state.paymentError).toBe("No se pudo completar el pago");
  });
});

describe("confirmPayment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("tokenizes in the browser then charges through the API", async () => {
    vi.mocked(tokenizeCard).mockResolvedValue({
      paymentToken: "tok_test",
      acceptanceToken: "acc",
      acceptPersonalAuth: "personal",
    });
    vi.mocked(createCustomer).mockResolvedValue({
      id: "c1",
      ...draft.customer,
    });
    vi.mocked(createDelivery).mockResolvedValue({
      id: "d1",
      customerId: "c1",
      ...draft.delivery,
      status: "draft",
    });
    vi.mocked(createPendingTransaction).mockResolvedValue({ ...paid, status: "PENDING" });
    vi.mocked(payTransaction).mockResolvedValue({ ...paid, status: "PENDING" });
    vi.mocked(pollTransactionUntilTerminal).mockResolvedValue(paid);

    saveCardSession({
      pan: "4111111111111111",
      cvc: "123",
      expiry: "12/29",
      cardholder: "ANA PEREZ",
    });
    const store = makeStore(
      testState({ item: headphones, status: "succeeded" }, { ...draft, summaryOpen: true }),
    );
    await store.dispatch(confirmPayment());
    expect(store.getState().checkout.screen).toBe("status");
    expect(store.getState().checkout.transaction?.status).toBe("APPROVED");
    expect(vi.mocked(tokenizeCard)).toHaveBeenCalled();
  });

  it("retries pay on the same PENDING instead of reserving stock again", async () => {
    vi.mocked(tokenizeCard).mockResolvedValue({
      paymentToken: "tok_test",
      acceptanceToken: "acc",
      acceptPersonalAuth: "personal",
    });
    vi.mocked(createCustomer).mockResolvedValue({
      id: "c1",
      ...draft.customer,
    });
    vi.mocked(createDelivery).mockResolvedValue({
      id: "d1",
      customerId: "c1",
      ...draft.delivery,
      status: "draft",
    });
    vi.mocked(createPendingTransaction).mockResolvedValue({ ...paid, status: "PENDING" });
    vi.mocked(payTransaction)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ ...paid, status: "PENDING" });
    vi.mocked(pollTransactionUntilTerminal).mockResolvedValue(paid);

    saveCardSession({
      pan: "4111111111111111",
      cvc: "123",
      expiry: "12/29",
      cardholder: "ANA PEREZ",
    });
    const store = makeStore(
      testState({ item: headphones, status: "succeeded" }, { ...draft, summaryOpen: true }),
    );
    await store.dispatch(confirmPayment());
    expect(store.getState().checkout.paymentStatus).toBe("failed");
    expect(store.getState().checkout.transaction?.status).toBe("PENDING");
    vi.mocked(createPendingTransaction).mockClear();
    vi.mocked(payTransaction).mockClear();
    vi.mocked(payTransaction).mockResolvedValue({ ...paid, status: "PENDING" });

    await store.dispatch(confirmPayment());
    expect(vi.mocked(createPendingTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(payTransaction)).toHaveBeenCalledTimes(1);
    expect(store.getState().checkout.transaction?.status).toBe("APPROVED");
  });

  it("asks to re-enter the card when the session is gone", async () => {
    const store = makeStore(
      testState({ item: headphones, status: "succeeded" }, { ...draft, summaryOpen: true }),
    );
    const result = await store.dispatch(confirmPayment());
    expect(result.type).toBe(confirmPayment.rejected.type);
    expect(store.getState().checkout.paymentError).toBe("Vuelve a ingresar la tarjeta");
  });

  it("fails when checkout data is missing", async () => {
    const store = makeStore(testState());
    await store.dispatch(confirmPayment());
    expect(store.getState().checkout.paymentError).toBe("Faltan datos del checkout");
  });
});

describe("loadQuote", () => {
  it("stores the server quote", async () => {
    vi.mocked(fetchQuote).mockResolvedValue(quote);
    const store = makeStore(testState({ item: headphones, status: "succeeded" }));
    await store.dispatch(loadQuote({ productId: headphones.id }));
    expect(store.getState().checkout.quote?.totalCents).toBe(14_290_000);
  });
});
