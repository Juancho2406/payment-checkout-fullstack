import {
  cardLast4,
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidCardholder,
  isValidCvc,
  isValidExpiry,
  luhnOk,
} from "./card";

describe("card helpers", () => {
  it("detects Visa and Mastercard from BIN", () => {
    expect(detectCardBrand("4111111111111111")).toBe("VISA");
    expect(detectCardBrand("5555555555554444")).toBe("MASTERCARD");
    expect(detectCardBrand("2223003122003222")).toBe("MASTERCARD");
    expect(detectCardBrand("6011111111111117")).toBeNull();
  });

  it("formats the PAN in 4-digit groups", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(digitsOnly("41-11")).toBe("4111");
  });

  it("accepts a Luhn-valid Visa and rejects a mutated one", () => {
    expect(luhnOk("4111111111111111")).toBe(true);
    expect(luhnOk("5555555555554444")).toBe(true);
    expect(luhnOk("4111111111111112")).toBe(false);
    expect(luhnOk("4111")).toBe(false);
  });

  it("returns last4 without keeping the rest of the PAN", () => {
    expect(cardLast4("4111 1111 1111 1111")).toBe("1111");
  });

  it("formats and validates expiry", () => {
    expect(formatExpiry("1")).toBe("1");
    expect(formatExpiry("12")).toBe("12");
    expect(formatExpiry("1229")).toBe("12/29");
    expect(isValidExpiry("13/29")).toBe(false);
    expect(isValidExpiry("ab")).toBe(false);
    expect(isValidExpiry("12/99", new Date("2026-08-01"))).toBe(true);
    expect(isValidExpiry("01/20", new Date("2026-08-01"))).toBe(false);
  });

  it("validates CVC and cardholder", () => {
    expect(isValidCvc("123")).toBe(true);
    expect(isValidCvc("12")).toBe(false);
    expect(isValidCardholder("ANA")).toBe(true);
    expect(isValidCardholder("AB")).toBe(false);
  });
});

