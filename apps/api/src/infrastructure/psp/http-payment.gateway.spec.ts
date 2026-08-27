import { mapPspTransactionPayload } from "./http-payment.gateway";

describe("mapPspTransactionPayload", () => {
  it("maps a sandbox data wrapper to a charge", () => {
    expect(
      mapPspTransactionPayload({
        data: {
          id: "psp-1",
          status: "APPROVED",
          payment_method: {
            extra: { brand: "VISA", last_four: "4242" },
          },
        },
      }),
    ).toEqual({
      pspTransactionId: "psp-1",
      status: "APPROVED",
      cardBrand: "VISA",
      cardLast4: "4242",
    });
  });

  it("returns null when the payload has no id", () => {
    expect(mapPspTransactionPayload({ data: { status: "PENDING" } })).toBeNull();
  });
});
