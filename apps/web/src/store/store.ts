import { configureStore } from "@reduxjs/toolkit";
import { productReducer, type ProductState } from "../features/product/productSlice";

export type RootState = {
  product: ProductState;
};

export function makeStore(preloadedState?: { product: ProductState }) {
  if (!preloadedState) {
    return configureStore({
      reducer: {
        product: productReducer,
      },
    });
  }
  return configureStore({
    reducer: {
      product: productReducer,
    },
    preloadedState,
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
