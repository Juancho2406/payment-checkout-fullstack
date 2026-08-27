import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchCatalog, type CatalogProduct } from "../../lib/api";

export type ProductState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  item: CatalogProduct | null;
  error: string | null;
};

const initialState: ProductState = {
  status: "idle",
  item: null,
  error: null,
};

export const loadCatalog = createAsyncThunk(
  "product/loadCatalog",
  async (): Promise<CatalogProduct | null> => {
    const catalog = await fetchCatalog();
    return catalog[0] ?? null;
  },
);

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCatalog.pending, (state) => {
        if (state.status !== "succeeded") {
          state.status = "loading";
        }
        state.error = null;
      })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.item = action.payload;
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "No se pudo cargar el producto";
      });
  },
});

export const productReducer = productSlice.reducer;
