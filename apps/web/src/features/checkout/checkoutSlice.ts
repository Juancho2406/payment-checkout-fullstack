import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { fetchQuote, type CheckoutQuote } from "../../lib/api";
import type { CardBrand } from "../../lib/card";

export type CustomerDraft = {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
};

export type DeliveryDraft = {
  readonly address: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
};

export type CardPreview = {
  readonly brand: CardBrand;
  readonly last4: string;
};

export type QuoteStatus = "idle" | "loading" | "succeeded" | "failed";

export type CheckoutState = {
  modalOpen: boolean;
  summaryOpen: boolean;
  customer: CustomerDraft | null;
  delivery: DeliveryDraft | null;
  cardPreview: CardPreview | null;
  quoteStatus: QuoteStatus;
  quote: CheckoutQuote | null;
  quoteError: string | null;
};

export const initialCheckoutState: CheckoutState = {
  modalOpen: false,
  summaryOpen: false,
  customer: null,
  delivery: null,
  cardPreview: null,
  quoteStatus: "idle",
  quote: null,
  quoteError: null,
};

export const loadQuote = createAsyncThunk(
  "checkout/loadQuote",
  async (input: { productId: string; quantity?: number }): Promise<CheckoutQuote> => {
    return fetchQuote(input.productId, input.quantity ?? 1);
  },
);

const checkoutSlice = createSlice({
  name: "checkout",
  initialState: initialCheckoutState,
  reducers: {
    openCheckoutModal(state) {
      state.modalOpen = true;
    },
    closeCheckoutModal(state) {
      state.modalOpen = false;
    },
    closeSummaryBackdrop(state) {
      state.summaryOpen = false;
    },
    backToCheckoutModal(state) {
      state.summaryOpen = false;
      state.modalOpen = true;
    },
    saveCheckoutDraft(
      state,
      action: PayloadAction<{
        customer: CustomerDraft;
        delivery: DeliveryDraft;
        cardPreview: CardPreview;
      }>,
    ) {
      state.customer = action.payload.customer;
      state.delivery = action.payload.delivery;
      state.cardPreview = action.payload.cardPreview;
      state.modalOpen = false;
      state.summaryOpen = true;
      state.quoteStatus = "idle";
      state.quote = null;
      state.quoteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadQuote.pending, (state) => {
        state.quoteStatus = "loading";
        state.quoteError = null;
      })
      .addCase(loadQuote.fulfilled, (state, action) => {
        state.quoteStatus = "succeeded";
        state.quote = action.payload;
      })
      .addCase(loadQuote.rejected, (state, action) => {
        state.quoteStatus = "failed";
        state.quote = null;
        state.quoteError = action.error.message ?? "No se pudo calcular el total";
      });
  },
});

export const {
  openCheckoutModal,
  closeCheckoutModal,
  closeSummaryBackdrop,
  backToCheckoutModal,
  saveCheckoutDraft,
} = checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
