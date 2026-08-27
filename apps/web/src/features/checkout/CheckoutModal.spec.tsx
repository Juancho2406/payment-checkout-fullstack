import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { clearBrowserCardSecrets, peekCardSession } from "../../lib/card-session";
import { makeStore, testState } from "../../store/store";
import { CheckoutModal } from "./CheckoutModal";

function renderModal() {
  const store = makeStore(
    testState(
      {},
      {
        modalOpen: true,
      },
    ),
  );
  return {
    store,
    ...render(
      <Provider store={store}>
        <CheckoutModal />
      </Provider>,
    ),
  };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("Celular"), "3001112233");
  await user.type(screen.getByTestId("card-number"), "4111111111111111");
  await user.type(screen.getByTestId("card-expiry"), "1229");
  await user.type(screen.getByTestId("card-cvc"), "123");
  await user.type(screen.getByLabelText("Titular"), "ANA PEREZ");
  await user.type(screen.getByLabelText("Dirección"), "Cra 7 # 12-34");
  await user.type(screen.getByLabelText("Ciudad"), "Bogotá");
  await user.type(screen.getByLabelText("Departamento"), "Cundinamarca");
  await user.type(screen.getByLabelText("Código postal"), "110111");
}

describe("CheckoutModal", () => {
  afterEach(() => {
    clearBrowserCardSecrets();
  });
  it("rejects a card that fails Luhn", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId("card-number"), "4111111111111112");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Número de tarjeta inválido")).toBeInTheDocument();
  });

  it("saves last4 and brand without the PAN", async () => {
    const user = userEvent.setup();
    const { store } = renderModal();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const snapshot = JSON.stringify(store.getState());
    const checkout = store.getState().checkout;
    expect(checkout.cardPreview).toEqual({ brand: "VISA", last4: "1111" });
    expect(snapshot).not.toContain("4111111111111111");
    expect(snapshot.toLowerCase()).not.toContain("cvc");
    expect(checkout.customer?.email).toBe("ana@example.com");
    expect(checkout.delivery?.city).toBe("Bogotá");
    expect(checkout.modalOpen).toBe(false);
    expect(checkout.summaryOpen).toBe(true);
    expect(peekCardSession()?.pan).toBe("4111111111111111");
    expect(peekCardSession()?.cvc).toBe("123");
  });
});
