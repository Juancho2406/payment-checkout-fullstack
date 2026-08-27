import { configureStore } from "@reduxjs/toolkit";
import {
  checkoutReducer,
  initialCheckoutState,
  type CheckoutState,
} from "../features/checkout/checkoutSlice";
import { productReducer, type ProductState } from "../features/product/productSlice";
import { loadPersistedCheckout, savePersistedCheckout } from "./persist";

export type RootState = {
  product: ProductState;
  checkout: CheckoutState;
};

const reducer = {
  product: productReducer,
  checkout: checkoutReducer,
};

export const emptyProduct: ProductState = {
  status: "idle",
  item: null,
  error: null,
};

export function makeStore(preloadedState?: RootState) {
  if (preloadedState) {
    return configureStore({ reducer, preloadedState });
  }
  const persisted = loadPersistedCheckout();
  const store = configureStore({
    reducer,
    preloadedState: persisted
      ? { product: emptyProduct, checkout: persisted }
      : undefined,
  });
  store.subscribe(() => {
    savePersistedCheckout(store.getState());
  });
  return store;
}

export function testState(
  product: Partial<ProductState> = {},
  checkout: Partial<CheckoutState> = {},
): RootState {
  return {
    product: { ...emptyProduct, ...product },
    checkout: { ...initialCheckoutState, ...checkout },
  };
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
