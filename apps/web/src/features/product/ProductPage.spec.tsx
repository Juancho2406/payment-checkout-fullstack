import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import type { CatalogProduct } from "../../lib/api";
import { makeStore, testState } from "../../store/store";
import { ProductPage } from "./ProductPage";
import type { ProductState } from "./productSlice";

const headphones: CatalogProduct = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear Bluetooth con cancelación de ruido. Producto dummy del catálogo.",
  priceCents: 12990000,
  currency: "COP",
  stock: 8,
  imageUrl: "https://example.com/headphones.jpg",
};

function renderPage(product: Partial<ProductState> = {}) {
  const store = makeStore(
    testState({
      status: "succeeded",
      item: headphones,
      error: null,
      ...product,
    }),
  );
  return {
    store,
    ...render(
      <Provider store={store}>
        <ProductPage />
      </Provider>,
    ),
  };
}

describe("ProductPage", () => {
  it("shows name, price, stock and the pay button", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: headphones.name })).toBeInTheDocument();
    expect(screen.getByText(headphones.description)).toBeInTheDocument();
    expect(screen.getByText("8 disponibles")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pagar con tarjeta de crédito" }),
    ).toBeEnabled();
    expect(screen.getByText(/129[.,\s]?900/)).toBeInTheDocument();
  });

  it("disables pay when there is no stock", () => {
    renderPage({ item: { ...headphones, stock: 0 } });

    expect(screen.getByText("Sin unidades")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pagar con tarjeta de crédito" }),
    ).toBeDisabled();
  });

  it("shows an error and a retry action", () => {
    renderPage({
      status: "failed",
      item: null,
      error: "No se pudo cargar el catálogo",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("opens the checkout modal from the pay button", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Pagar con tarjeta de crédito" }));

    expect(screen.getByRole("dialog", { name: "Pago y entrega" })).toBeInTheDocument();
  });
});
