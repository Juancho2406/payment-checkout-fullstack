import { createHash } from "node:crypto";
import type { Result } from "./result";
import { PRODUCT_CURRENCY } from "./product";

export const PAYMENT_GATEWAY = Symbol("PaymentGateway");
export const PAYMENT_SETTINGS = Symbol("PaymentSettings");

export type PspChargeStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "VOIDED"
  | "ERROR";

export type PspCharge = {
  readonly pspTransactionId: string;
  readonly status: PspChargeStatus;
  readonly cardBrand: string | null;
  readonly cardLast4: string | null;
};

export type CreateChargeInput = {
  readonly amountInCents: number;
  readonly currency: typeof PRODUCT_CURRENCY;
  readonly customerEmail: string;
  readonly paymentToken: string;
  readonly reference: string;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuth?: string;
  readonly installments: number;
  readonly signature: string;
};

export type PspDeclinedError = {
  readonly code: "PSP_DECLINED";
  readonly message: string;
};

export type PspTimeoutError = {
  readonly code: "PSP_TIMEOUT";
  readonly message: string;
};

export type PaymentValidationError = {
  readonly code: "VALIDATION_ERROR";
  readonly message: string;
};

export function pspDeclined(message: string): PspDeclinedError {
  return { code: "PSP_DECLINED", message };
}

export function pspTimeout(): PspTimeoutError {
  return {
    code: "PSP_TIMEOUT",
    message: "PSP did not reach a terminal status before the poll deadline",
  };
}

export function paymentValidationError(message: string): PaymentValidationError {
  return { code: "VALIDATION_ERROR", message };
}

export function integritySignature(input: {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly secret: string;
}): string {
  return createHash("sha256")
    .update(
      `${input.reference}${input.amountInCents}${input.currency}${input.secret}`,
    )
    .digest("hex");
}

export type PaymentSettings = {
  readonly integritySecret: string;
  readonly pollIntervalMs: number;
  readonly pollMaxAttempts: number;
  readonly sleep: (ms: number) => Promise<void>;
};

export function defaultPaymentSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface PaymentGateway {
  createCharge(
    input: CreateChargeInput,
  ): Promise<Result<PspCharge, PspDeclinedError>>;
  getChargeStatus(
    pspTransactionId: string,
  ): Promise<Result<PspCharge, PspDeclinedError>>;
}
