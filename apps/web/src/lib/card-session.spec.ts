import {
  clearBrowserCardSecrets,
  peekCardSession,
  peekIssuedTokens,
  saveCardSession,
  saveIssuedTokens,
  takeCardSession,
  takeIssuedTokens,
} from "./card-session";

describe("card-session", () => {
  afterEach(() => {
    clearBrowserCardSecrets();
  });

  it("holds PAN only in module memory and drops it on take", () => {
    saveCardSession({
      pan: "4111111111111111",
      cvc: "123",
      expiry: "12/29",
      cardholder: "ANA PEREZ",
    });
    expect(peekCardSession()?.pan).toBe("4111111111111111");
    expect(takeCardSession()?.cvc).toBe("123");
    expect(peekCardSession()).toBeNull();
    expect(takeCardSession()).toBeNull();
  });

  it("stores one-shot PSP tokens and clears them with the card", () => {
    saveIssuedTokens({
      paymentToken: "tok_test",
      acceptanceToken: "acc",
      acceptPersonalAuth: "personal",
    });
    expect(peekIssuedTokens()?.paymentToken).toBe("tok_test");
    expect(takeIssuedTokens()?.acceptanceToken).toBe("acc");
    expect(peekIssuedTokens()).toBeNull();

    saveCardSession({
      pan: "4111111111111111",
      cvc: "123",
      expiry: "12/29",
      cardholder: "ANA",
    });
    saveIssuedTokens({ paymentToken: "tok_2", acceptanceToken: "acc-2" });
    saveCardSession({
      pan: "5555555555554444",
      cvc: "321",
      expiry: "01/30",
      cardholder: "ANA",
    });
    expect(peekIssuedTokens()).toBeNull();
    clearBrowserCardSecrets();
    expect(peekCardSession()).toBeNull();
  });
});
