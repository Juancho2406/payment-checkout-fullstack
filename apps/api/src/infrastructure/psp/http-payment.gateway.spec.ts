import { HttpPaymentGateway, mapPspTransactionPayload } from "./http-payment.gateway";
import type { CreateChargeInput } from "../../domain/payment";

const chargeInput: CreateChargeInput = {
  amountInCents: 21200000,
  currency: "COP",
  customerEmail: "ana@example.com",
  paymentToken: "tok_test",
  reference: "CHK-1",
  acceptanceToken: "acc",
  acceptPersonalAuth: "personal",
  installments: 1,
  signature: "sig",
};

const approvedPayload = {
  data: {
    id: "psp-1",
    status: "APPROVED",
    payment_method: { extra: { brand: "VISA", last_four: "4242" } },
  },
};

describe("mapPspTransactionPayload", () => {
  it("maps a sandbox data wrapper to a charge", () => {
    expect(mapPspTransactionPayload(approvedPayload)).toEqual({
      pspTransactionId: "psp-1",
      status: "APPROVED",
      cardBrand: "VISA",
      cardLast4: "4242",
    });
  });

  it("maps a bare payload and nulls empty extra fields", () => {
    expect(
      mapPspTransactionPayload({
        id: "psp-2",
        status: "PENDING",
        payment_method: { extra: { brand: "", last_four: 12 } },
      }),
    ).toEqual({
      pspTransactionId: "psp-2",
      status: "PENDING",
      cardBrand: null,
      cardLast4: null,
    });
  });

  it("returns null when the payload has no id", () => {
    expect(mapPspTransactionPayload({ data: { status: "PENDING" } })).toBeNull();
  });

  it("returns null for an unknown status or non-object", () => {
    expect(mapPspTransactionPayload({ data: { id: "psp-1", status: "NOPE" } })).toBeNull();
    expect(mapPspTransactionPayload(null)).toBeNull();
  });
});

describe("HttpPaymentGateway", () => {
  it("returns PSP_DECLINED when the PSP is not configured", async () => {
    const fetchImpl = jest.fn();
    const gateway = new HttpPaymentGateway({
      baseUrl: "",
      privateKey: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(gateway.createCharge(chargeInput)).resolves.toMatchObject({
      ok: false,
    });
    await expect(gateway.getChargeStatus("psp-1")).resolves.toMatchObject({
      ok: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs a charge including accept_personal_auth", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => approvedPayload,
    });
    const gateway = new HttpPaymentGateway({
      baseUrl: "https://psp.example/v1/",
      privateKey: "prv_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await gateway.createCharge(chargeInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pspTransactionId).toBe("psp-1");
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://psp.example/v1/transactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer prv_test",
        }),
      }),
    );
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain(
      "accept_personal_auth",
    );
  });

  it("GETs charge status", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => approvedPayload,
    });
    const gateway = new HttpPaymentGateway({
      baseUrl: "https://psp.example/v1",
      privateKey: "prv_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await gateway.getChargeStatus("psp 1");
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://psp.example/v1/transactions/psp%201",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns PSP_DECLINED when the sandbox rejects the payload", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    });
    const gateway = new HttpPaymentGateway({
      baseUrl: "https://psp.example/v1",
      privateKey: "prv_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await gateway.createCharge({
      ...chargeInput,
      acceptPersonalAuth: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PSP_DECLINED");
    }
  });

  it("returns PSP_DECLINED when the PSP is unreachable", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network"));
    const gateway = new HttpPaymentGateway({
      baseUrl: "https://psp.example/v1",
      privateKey: "prv_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await gateway.createCharge(chargeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("PSP is unreachable");
    }
  });
});
