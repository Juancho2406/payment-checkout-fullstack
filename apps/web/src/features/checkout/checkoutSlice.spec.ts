import {
  checkoutReducer,
  initialCheckoutState,
  saveCheckoutDraft,
} from "./checkoutSlice";

describe("checkoutSlice", () => {
  it("stores brand and last4 and never the PAN", () => {
    const pan = "4111111111111111";
    const state = checkoutReducer(
      initialCheckoutState,
      saveCheckoutDraft({
        customer: {
          fullName: "Ana Pérez",
          email: "ana@example.com",
          phone: "3001112233",
        },
        delivery: {
          address: "Cra 7 # 12-34",
          city: "Bogotá",
          region: "Cundinamarca",
          postalCode: "110111",
        },
        cardPreview: { brand: "VISA", last4: "1111" },
      }),
    );

    expect(state.cardPreview).toEqual({ brand: "VISA", last4: "1111" });
    expect(JSON.stringify(state)).not.toContain(pan);
    expect(JSON.stringify(state)).not.toContain("cvc");
    expect(state.modalOpen).toBe(false);
  });
});
