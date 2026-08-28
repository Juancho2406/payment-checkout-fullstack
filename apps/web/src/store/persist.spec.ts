import { saveCheckoutDraft } from "../features/checkout/checkoutSlice";
import {
  CHECKOUT_PERSIST_KEY,
  containsSecrets,
  loadPersistedCheckout,
  savePersistedCheckout,
  toPersistedCheckout,
} from "./persist";
import { makeStore, testState } from "./store";

const delivery = {
  address: "Cra 7 # 12-34",
  city: "Bogotá",
  region: "Cundinamarca",
  postalCode: "110111",
};

const transaction = {
  id: "tx-1",
  reference: "CHK-1",
  status: "APPROVED" as const,
  productId: "prod-1",
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

describe("checkout persist", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips step, delivery, productId and transactionId", () => {
    const state = testState(
      { item: { id: "prod-1", name: "x", description: "", priceCents: 1, currency: "COP", stock: 1, imageUrl: "" } },
      {
        screen: "status",
        delivery,
        transaction,
      },
    );
    const snapshot = toPersistedCheckout(state);
    expect(snapshot.productId).toBe("prod-1");
    expect(snapshot.delivery?.city).toBe("Bogotá");
    expect(snapshot.transaction?.id).toBe("tx-1");
    expect(JSON.stringify(snapshot)).not.toContain("4111111111111111");
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain("cvc");
    expect(JSON.stringify(snapshot)).not.toContain("tok_");

    savePersistedCheckout(state);
    const restored = loadPersistedCheckout();
    expect(restored?.screen).toBe("status");
    expect(restored?.delivery?.address).toBe("Cra 7 # 12-34");
    expect(restored?.transaction?.id).toBe("tx-1");
  });

  it("drops storage that contains PAN, CVC or a card token", () => {
    localStorage.setItem(
      CHECKOUT_PERSIST_KEY,
      JSON.stringify({
        version: 1,
        screen: "product",
        summaryOpen: true,
        modalOpen: false,
        customer: null,
        delivery,
        cardPreview: null,
        productId: "prod-1",
        quantity: 1,
        transaction: null,
        pan: "4111111111111111",
        cvc: "123",
      }),
    );
    expect(containsSecrets(JSON.parse(localStorage.getItem(CHECKOUT_PERSIST_KEY) ?? "{}"))).toBe(
      true,
    );
    expect(loadPersistedCheckout()).toBeNull();
    expect(localStorage.getItem(CHECKOUT_PERSIST_KEY)).toBeNull();

    localStorage.setItem(
      CHECKOUT_PERSIST_KEY,
      JSON.stringify({
        version: 1,
        screen: "product",
        summaryOpen: true,
        modalOpen: false,
        customer: null,
        delivery,
        cardPreview: null,
        productId: "prod-1",
        quantity: 1,
        transaction: null,
        paymentToken: "tok_test_abc",
      }),
    );
    expect(loadPersistedCheckout()).toBeNull();
    expect(localStorage.getItem(CHECKOUT_PERSIST_KEY)).toBeNull();
  });

  it("hydrates a new store from localStorage", () => {
    const live = makeStore(
      testState(
        {},
        {
          summaryOpen: true,
          delivery,
          cardPreview: { brand: "VISA", last4: "1111" },
        },
      ),
    );
    live.dispatch(
      saveCheckoutDraft({
        customer: { fullName: "Ana Pérez", email: "ana@example.com", phone: "3001112233" },
        delivery,
        cardPreview: { brand: "VISA", last4: "1111" },
      }),
    );
    savePersistedCheckout(live.getState());

    const hydrated = makeStore();
    expect(hydrated.getState().checkout.summaryOpen).toBe(true);
    expect(hydrated.getState().checkout.customer?.email).toBe("ana@example.com");
    expect(hydrated.getState().checkout.delivery?.city).toBe("Bogotá");
    expect(hydrated.getState().checkout.selectedProductId).toBeNull();
    expect(JSON.stringify(hydrated.getState())).not.toContain("4111111111111111");
  });

  it("restores the selected product and does not mark a PENDING pay as succeeded", () => {
    savePersistedCheckout(
      testState(
        { item: { id: "prod-1", name: "x", description: "", priceCents: 1, currency: "COP", stock: 1, imageUrl: "" } },
        {
          summaryOpen: true,
          selectedProductId: "prod-1",
          transaction: { ...transaction, status: "PENDING", pspTransactionId: null },
        },
      ),
    );
    const hydrated = makeStore();
    expect(hydrated.getState().checkout.selectedProductId).toBe("prod-1");
    expect(hydrated.getState().checkout.paymentStatus).toBe("idle");
    expect(hydrated.getState().checkout.transaction?.status).toBe("PENDING");
  });

  it("clears storage when checkout is reset to empty", () => {
    savePersistedCheckout(testState({}, { delivery, summaryOpen: true }));
    expect(localStorage.getItem(CHECKOUT_PERSIST_KEY)).not.toBeNull();
    savePersistedCheckout(testState());
    expect(localStorage.getItem(CHECKOUT_PERSIST_KEY)).toBeNull();
  });
});
