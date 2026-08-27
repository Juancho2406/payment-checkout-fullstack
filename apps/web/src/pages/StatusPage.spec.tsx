import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { App } from "../App";
import type { CatalogProduct, CheckoutTransaction } from "../lib/api";
import { makeStore, testState } from "../store/store";

const headphones: CatalogProduct = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear Bluetooth con cancelación de ruido. Producto dummy del catálogo.",
  priceCents: 12_990_000,
  currency: "COP",
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
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
  baseFeeCents: 500_000,
  deliveryFeeCents: 800_000,
  totalCents: 14_290_000,
  currency: "COP",
  pspTransactionId: "psp-1",
  cardBrand: "VISA",
  cardLast4: "1111",
};

describe("StatusPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows APPROVED and returns to the product with refreshed stock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ ...headphones, stock: 7 }] }),
      }),
    );
    const store = makeStore(
      testState(
        { status: "succeeded", item: headphones, error: null },
        { screen: "status", paymentStatus: "succeeded", transaction: approvedTx },
      ),
    );
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(screen.getByRole("heading", { name: "Pago aprobado" })).toBeInTheDocument();
    expect(screen.getByText(/CHK-1/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver al producto" }));

    expect(await screen.findByRole("heading", { name: headphones.name })).toBeInTheDocument();
    expect(screen.getByText("7 disponibles")).toBeInTheDocument();
    expect(store.getState().checkout.screen).toBe("product");
    expect(store.getState().checkout.transaction).toBeNull();
  });

  it("shows DECLINED when the sandbox rejects the charge", () => {
    const store = makeStore(
      testState(
        { status: "succeeded", item: headphones, error: null },
        {
          screen: "status",
          paymentStatus: "succeeded",
          transaction: { ...approvedTx, status: "DECLINED" },
        },
      ),
    );
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(screen.getByRole("heading", { name: "Pago rechazado" })).toBeInTheDocument();
  });
});
