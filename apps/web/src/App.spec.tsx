import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { App } from "./App";
import { makeStore, testState } from "./store/store";

vi.mock("./features/product/ProductPage", () => ({
  ProductPage: () => <div>product-screen</div>,
}));

vi.mock("./pages/StatusPage", () => ({
  StatusPage: () => <div>status-screen</div>,
}));

describe("App", () => {
  it("shows the product page by default", () => {
    render(
      <Provider store={makeStore(testState())}>
        <App />
      </Provider>,
    );
    expect(screen.getByText("product-screen")).toBeInTheDocument();
  });

  it("shows the status page after a payment", () => {
    render(
      <Provider store={makeStore(testState({}, { screen: "status" }))}>
        <App />
      </Provider>,
    );
    expect(screen.getByText("status-screen")).toBeInTheDocument();
  });
});
