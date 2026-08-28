import { createAction, createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  createCustomer,
  createDelivery,
  createPendingTransaction,
  fetchQuote,
  payTransaction,
  pollTransactionUntilTerminal,
  type CatalogProduct,
  type CheckoutQuote,
  type CheckoutTransaction,
} from "../../lib/api";
import type { CardBrand } from "../../lib/card";
import {
  peekCardSession,
  peekIssuedTokens,
  saveIssuedTokens,
  takeCardSession,
  takeIssuedTokens,
} from "../../lib/card-session";
import { cardSessionToTokenizeInput, tokenizeCard } from "../../lib/psp-tokenize";

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
export type PaymentStatus = "idle" | "paying" | "succeeded" | "failed";
export type CheckoutScreen = "product" | "status";

export type CheckoutState = {
  screen: CheckoutScreen;
  modalOpen: boolean;
  summaryOpen: boolean;
  customer: CustomerDraft | null;
  delivery: DeliveryDraft | null;
  cardPreview: CardPreview | null;
  quoteStatus: QuoteStatus;
  quote: CheckoutQuote | null;
  quoteError: string | null;
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  transaction: CheckoutTransaction | null;
  selectedProductId: string | null;
};

export const initialCheckoutState: CheckoutState = {
  screen: "product",
  modalOpen: false,
  summaryOpen: false,
  customer: null,
  delivery: null,
  cardPreview: null,
  quoteStatus: "idle",
  quote: null,
  quoteError: null,
  paymentStatus: "idle",
  paymentError: null,
  transaction: null,
  selectedProductId: null,
};

export const loadQuote = createAsyncThunk(
  "checkout/loadQuote",
  async (input: { productId: string; quantity?: number }): Promise<CheckoutQuote> => {
    return fetchQuote(input.productId, input.quantity ?? 1);
  },
);

export const stashPendingTransaction = createAction<CheckoutTransaction>(
  "checkout/stashPendingTransaction",
);

function canReusePending(
  transaction: CheckoutTransaction | null,
  productId: string,
): transaction is CheckoutTransaction {
  return (
    transaction !== null &&
    transaction.productId === productId &&
    (transaction.status === "PENDING" || transaction.status === "ERROR")
  );
}

export const confirmPayment = createAsyncThunk(
  "checkout/confirmPayment",
  async (_, { getState, dispatch }): Promise<CheckoutTransaction> => {
    const { product, checkout } = getState() as {
      product: { item: CatalogProduct | null };
      checkout: CheckoutState;
    };
    const catalogItem = product.item;
    const customer = checkout.customer;
    const delivery = checkout.delivery;
    if (!catalogItem || !customer || !delivery) {
      throw new Error("Faltan datos del checkout");
    }

    let tokens = peekIssuedTokens();
    const card = peekCardSession();
    if (card) {
      tokens = await tokenizeCard(cardSessionToTokenizeInput(card));
      saveIssuedTokens(tokens);
      takeCardSession();
    }
    if (!tokens) {
      throw new Error("Vuelve a ingresar la tarjeta");
    }

    let pending = (getState() as { checkout: CheckoutState }).checkout.transaction;
    if (!canReusePending(pending, catalogItem.id)) {
      const createdCustomer = await createCustomer(customer);
      const createdDelivery = await createDelivery({
        customerId: createdCustomer.id,
        address: delivery.address,
        city: delivery.city,
        region: delivery.region,
        postalCode: delivery.postalCode,
      });
      pending = await createPendingTransaction({
        productId: catalogItem.id,
        quantity: 1,
        customerId: createdCustomer.id,
        deliveryId: createdDelivery.id,
      });
      dispatch(stashPendingTransaction(pending));
    }
    if (!pending) {
      throw new Error("Faltan datos del checkout");
    }
    let paid = await payTransaction(pending.id, {
      paymentToken: tokens.paymentToken,
      acceptanceToken: tokens.acceptanceToken,
      acceptPersonalAuth: tokens.acceptPersonalAuth,
      installments: 1,
    });
    if (paid.status === "PENDING") {
      paid = await pollTransactionUntilTerminal(paid.id);
    }
    takeIssuedTokens();
    return paid;
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
      state.paymentStatus = "idle";
      state.paymentError = null;
    },
    resetCheckout() {
      return initialCheckoutState;
    },
    rememberProductId(state, action: PayloadAction<string>) {
      state.selectedProductId = action.payload;
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
      state.paymentStatus = "idle";
      state.paymentError = null;
      if (
        state.transaction?.status !== "PENDING" &&
        state.transaction?.status !== "ERROR"
      ) {
        state.transaction = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(stashPendingTransaction, (state, action) => {
        state.transaction = action.payload;
      })
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
      })
      .addCase(confirmPayment.pending, (state) => {
        state.paymentStatus = "paying";
        state.paymentError = null;
      })
      .addCase(confirmPayment.fulfilled, (state, action) => {
        state.paymentStatus = "succeeded";
        state.transaction = action.payload;
        state.summaryOpen = false;
        state.modalOpen = false;
        state.screen = "status";
      })
      .addCase(confirmPayment.rejected, (state, action) => {
        state.paymentStatus = "failed";
        state.paymentError = action.error.message ?? "No se pudo completar el pago";
      });
  },
});

export const {
  openCheckoutModal,
  closeCheckoutModal,
  closeSummaryBackdrop,
  backToCheckoutModal,
  resetCheckout,
  rememberProductId,
  saveCheckoutDraft,
} = checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
