import {
  cardLast4,
  detectCardBrand,
  formatCardNumber,
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
});
