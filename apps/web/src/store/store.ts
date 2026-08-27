import { configureStore } from "@reduxjs/toolkit";
import {
  checkoutReducer,
  initialCheckoutState,
  type CheckoutState,
} from "../features/checkout/checkoutSlice";
import { productReducer, type ProductState } from "../features/product/productSlice";

export type RootState = {
  product: ProductState;
  checkout: CheckoutState;
};

const reducer = {
  product: productReducer,
  checkout: checkoutReducer,
};

export function makeStore(preloadedState?: RootState) {
  if (!preloadedState) {
    return configureStore({ reducer });
  }
  return configureStore({ reducer, preloadedState });
}

export const emptyProduct: ProductState = {
  status: "idle",
  item: null,
  error: null,
};

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
