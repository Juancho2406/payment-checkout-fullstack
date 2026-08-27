import { randomBytes } from "node:crypto";
import { PRODUCT_CURRENCY } from "./product";

export const TRANSACTION_STATUS_PENDING = "PENDING" as const;
export const TRANSACTION_STATUS_APPROVED = "APPROVED" as const;
export const TRANSACTION_STATUS_DECLINED = "DECLINED" as const;
export const TRANSACTION_STATUS_ERROR = "ERROR" as const;

export type TransactionStatus =
  | typeof TRANSACTION_STATUS_PENDING
  | typeof TRANSACTION_STATUS_APPROVED
  | typeof TRANSACTION_STATUS_DECLINED
  | typeof TRANSACTION_STATUS_ERROR;

export type CheckoutTransaction = {
  readonly id: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly productId: string;
  readonly customerId: string;
  readonly deliveryId: string;
  readonly quantity: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
  readonly currency: typeof PRODUCT_CURRENCY;
};

export type TransactionNotFoundError = {
  readonly code: "NOT_FOUND";
  readonly message: string;
};

export type ConflictError = {
  readonly code: "CONFLICT";
  readonly message: string;
};

export type TransactionValidationError = {
  readonly code: "VALIDATION_ERROR";
  readonly message: string;
};

export function transactionNotFound(id: string): TransactionNotFoundError {
  return {
    code: "NOT_FOUND",
    message: `Transaction ${id} was not found`,
  };
}

export function referenceConflict(reference: string): ConflictError {
  return {
    code: "CONFLICT",
    message: `Reference ${reference} is already in use`,
  };
}

export function deliveryConflict(deliveryId: string): ConflictError {
  return {
    code: "CONFLICT",
    message: `Delivery ${deliveryId} is already linked to a transaction`,
  };
}

export function deliveryMismatch(): TransactionValidationError {
  return {
    code: "VALIDATION_ERROR",
    message: "deliveryId does not belong to customerId",
  };
}

export function invalidReference(value: unknown): TransactionValidationError {
  return {
    code: "VALIDATION_ERROR",
    message: `reference must be a non-empty string of at most 255 characters (received ${String(value)})`,
  };
}

const REFERENCE_MAX = 255;

export function isValidReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= REFERENCE_MAX
  );
}

export function generateReference(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `CHK-${day}-${suffix}`;
}

export type NewPendingTransaction = {
  readonly reference: string;
  readonly productId: string;
  readonly customerId: string;
  readonly deliveryId: string;
  readonly quantity: number;
  readonly productAmountCents: number;
  readonly baseFeeCents: number;
  readonly deliveryFeeCents: number;
  readonly totalCents: number;
  readonly currency: typeof PRODUCT_CURRENCY;
};

export type CreatePendingOutcome =
  | { readonly kind: "created"; readonly transaction: CheckoutTransaction }
  | { readonly kind: "stock" }
  | { readonly kind: "reference" }
  | { readonly kind: "delivery" };

export const TRANSACTION_REPOSITORY = Symbol("TransactionRepository");

export interface TransactionRepository {
  findById(id: string): Promise<CheckoutTransaction | null>;
  findByReference(reference: string): Promise<CheckoutTransaction | null>;
  /** Inserts PENDING and reserves stock in one step. */
  createPending(input: NewPendingTransaction): Promise<CreatePendingOutcome>;
}
