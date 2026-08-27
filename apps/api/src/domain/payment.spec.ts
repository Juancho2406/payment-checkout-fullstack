import { createHash } from "node:crypto";
import { defaultPaymentSleep, integritySignature, pspTimeout } from "./payment";

describe("integritySignature", () => {
  it("hashes reference + amount + currency + secret as SHA-256 hex", () => {
    const reference = "CHK-20260827-AB12CD";
    const amountInCents = 21200000;
    const currency = "COP";
    const secret = "test-integrity-secret";

    expect(
      integritySignature({ reference, amountInCents, currency, secret }),
    ).toBe(
      createHash("sha256")
        .update(`${reference}${amountInCents}${currency}${secret}`)
        .digest("hex"),
    );
  });
});

describe("pspTimeout", () => {
  it("returns PSP_TIMEOUT", () => {
    expect(pspTimeout().code).toBe("PSP_TIMEOUT");
  });
});

describe("defaultPaymentSleep", () => {
  it("resolves after the delay", async () => {
    jest.useFakeTimers();
    const pending = defaultPaymentSleep(25);
    jest.advanceTimersByTime(25);
    await pending;
    jest.useRealTimers();
  });
});
