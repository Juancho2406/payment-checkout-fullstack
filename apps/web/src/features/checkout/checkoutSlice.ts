import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
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

export type CheckoutState = {
  modalOpen: boolean;
  customer: CustomerDraft | null;
  delivery: DeliveryDraft | null;
  cardPreview: CardPreview | null;
};

export const initialCheckoutState: CheckoutState = {
  modalOpen: false,
  customer: null,
  delivery: null,
  cardPreview: null,
};

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
    },
  },
});

export const { openCheckoutModal, closeCheckoutModal, saveCheckoutDraft } =
  checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
