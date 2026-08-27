import { Injectable } from "@nestjs/common";
import { err, ok, type Result } from "../../domain/result";
import {
  pspDeclined,
  type CreateChargeInput,
  type PaymentGateway,
  type PspCharge,
  type PspChargeStatus,
  type PspDeclinedError,
} from "../../domain/payment";

export type PspHttpConfig = {
  readonly baseUrl: string;
  readonly privateKey: string;
  readonly fetchImpl?: typeof fetch;
};

type PspTransactionPayload = {
  readonly id?: unknown;
  readonly status?: unknown;
  readonly payment_method?: {
    readonly extra?: {
      readonly brand?: unknown;
      readonly last_four?: unknown;
    };
  };
};

@Injectable()
export class HttpPaymentGateway implements PaymentGateway {
  private readonly baseUrl: string;
  private readonly privateKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PspHttpConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.privateKey = config.privateKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createCharge(
    input: CreateChargeInput,
  ): Promise<Result<PspCharge, PspDeclinedError>> {
    if (!this.baseUrl || !this.privateKey) {
      return err(pspDeclined("PSP is not configured"));
    }
    const body: Record<string, unknown> = {
      amount_in_cents: input.amountInCents,
      currency: input.currency,
      customer_email: input.customerEmail,
      reference: input.reference,
      signature: input.signature,
      acceptance_token: input.acceptanceToken,
      payment_method: {
        type: "CARD",
        token: input.paymentToken,
        installments: input.installments,
      },
    };
    if (input.acceptPersonalAuth) {
      body.accept_personal_auth = input.acceptPersonalAuth;
    }
    return this.request("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getChargeStatus(
    pspTransactionId: string,
  ): Promise<Result<PspCharge, PspDeclinedError>> {
    if (!this.baseUrl || !this.privateKey) {
      return err(pspDeclined("PSP is not configured"));
    }
    return this.request(
      `/transactions/${encodeURIComponent(pspTransactionId)}`,
      { method: "GET" },
    );
  }

  private async request(
    path: string,
    init: { method: string; body?: string },
  ): Promise<Result<PspCharge, PspDeclinedError>> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.privateKey}`,
          "Content-Type": "application/json",
        },
        body: init.body,
      });
      const payload: unknown = await response.json().catch(() => null);
      const charge = mapPspTransactionPayload(payload);
      if (!response.ok || !charge) {
        return err(pspDeclined("PSP rejected the charge request"));
      }
      return ok(charge);
    } catch {
      return err(pspDeclined("PSP is unreachable"));
    }
  }
}

export function mapPspTransactionPayload(payload: unknown): PspCharge | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { data?: PspTransactionPayload } & PspTransactionPayload;
  const data = record.data ?? record;
  if (typeof data.id !== "string" || data.id.length === 0) {
    return null;
  }
  const status = toPspStatus(data.status);
  if (!status) {
    return null;
  }
  const extra = data.payment_method?.extra;
  return {
    pspTransactionId: data.id,
    status,
    cardBrand: stringOrNull(extra?.brand),
    cardLast4: stringOrNull(extra?.last_four),
  };
}

function toPspStatus(value: unknown): PspChargeStatus | null {
  if (
    value === "PENDING" ||
    value === "APPROVED" ||
    value === "DECLINED" ||
    value === "VOIDED" ||
    value === "ERROR"
  ) {
    return value;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
