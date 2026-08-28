import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { fetchCatalog, type CatalogProduct } from "../../lib/api";

export type ProductState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: CatalogProduct[];
  item: CatalogProduct | null;
  error: string | null;
};

const initialState: ProductState = {
  status: "idle",
  items: [],
  item: null,
  error: null,
};

export const loadCatalog = createAsyncThunk(
  "product/loadCatalog",
  async (): Promise<readonly CatalogProduct[]> => {
    return fetchCatalog();
  },
);

function pickSelected(
  items: readonly CatalogProduct[],
  selectedId: string | null,
): CatalogProduct | null {
  if (items.length === 0) {
    return null;
  }
  return items.find((row) => row.id === selectedId) ?? items[0] ?? null;
}

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    selectProduct(state, action: PayloadAction<string>) {
      state.item = pickSelected(state.items, action.payload);
    },
  },
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
        state.items = [...action.payload];
        state.item = pickSelected(action.payload, state.item?.id ?? null);
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "No se pudo cargar el producto";
      });
  },
});

export const { selectProduct } = productSlice.actions;
export const productReducer = productSlice.reducer;
