import {
  customerNotFound,
  type CustomerNotFoundError,
  type CustomerRepository,
} from "../../domain/customer";
import {
  integritySignature,
  paymentValidationError,
  pspTimeout,
  type PaymentGateway,
  type PaymentSettings,
  type PaymentValidationError,
  type PspCharge,
  type PspDeclinedError,
  type PspTimeoutError,
} from "../../domain/payment";
import { err, ok, type Result } from "../../domain/result";
import {
  isPaidTerminal,
  TRANSACTION_STATUS_APPROVED,
  TRANSACTION_STATUS_DECLINED,
  TRANSACTION_STATUS_ERROR,
  transactionNotFound,
  type CheckoutTransaction,
  type TransactionNotFoundError,
  type TransactionRepository,
} from "../../domain/transaction";

export type PayTransactionInput = {
  readonly transactionId: string;
  readonly paymentToken: unknown;
  readonly acceptanceToken: unknown;
  readonly acceptPersonalAuth?: unknown;
  readonly installments?: unknown;
};

export type PayTransactionError =
  | PaymentValidationError
  | TransactionNotFoundError
  | CustomerNotFoundError
  | PspDeclinedError
  | PspTimeoutError;

export class PayTransactionQuery {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly customers: CustomerRepository,
    private readonly gateway: PaymentGateway,
    private readonly settings: PaymentSettings,
  ) {}

  async execute(
    input: PayTransactionInput,
  ): Promise<Result<CheckoutTransaction, PayTransactionError>> {
    const tokens = readPayTokens(input);
    if (!tokens.ok) {
      return tokens;
    }

    const transaction = await this.transactions.findById(input.transactionId);
    if (!transaction) {
      return err(transactionNotFound(input.transactionId));
    }
    if (isPaidTerminal(transaction.status)) {
      return ok(transaction);
    }

    const customer = await this.customers.findById(transaction.customerId);
    if (!customer) {
      return err(customerNotFound(transaction.customerId));
    }

    if (transaction.pspTransactionId) {
      return this.settleFromPsp(transaction, transaction.pspTransactionId);
    }

    const claim = await this.transactions.tryClaimCharge(transaction.id);
    if (claim.kind === "unavailable") {
      return this.followInFlight(transaction.id);
    }

    const created = await this.gateway.createCharge({
      amountInCents: transaction.totalCents,
      currency: transaction.currency,
      customerEmail: customer.email,
      paymentToken: tokens.value.paymentToken,
      reference: transaction.reference,
      acceptanceToken: tokens.value.acceptanceToken,
      acceptPersonalAuth: tokens.value.acceptPersonalAuth,
      installments: tokens.value.installments,
      signature: integritySignature({
        reference: transaction.reference,
        amountInCents: transaction.totalCents,
        currency: transaction.currency,
        secret: this.settings.integritySecret,
      }),
    });
    if (!created.ok) {
      await this.transactions.releaseChargeClaim(transaction.id);
      return created;
    }
    const attached = await this.transactions.attachPspCharge(transaction.id, {
      pspTransactionId: created.value.pspTransactionId,
      cardBrand: created.value.cardBrand,
      cardLast4: created.value.cardLast4,
    });
    const current = attached ?? transaction;
    if (created.value.status === "PENDING") {
      return this.settleFromPsp(current, created.value.pspTransactionId);
    }
    return this.finalizeCharge(current, created.value);
  }

  private async followInFlight(
    transactionId: string,
  ): Promise<Result<CheckoutTransaction, PayTransactionError>> {
    for (let attempt = 0; attempt < this.settings.pollMaxAttempts; attempt++) {
      if (attempt > 0) {
        await this.settings.sleep(this.settings.pollIntervalMs);
      }
      const current = await this.transactions.findById(transactionId);
      if (!current) {
        return err(transactionNotFound(transactionId));
      }
      if (isPaidTerminal(current.status)) {
        return ok(current);
      }
      if (current.pspTransactionId) {
        return this.settleFromPsp(current, current.pspTransactionId);
      }
    }
    return err(pspTimeout());
  }

  private async settleFromPsp(
    transaction: CheckoutTransaction,
    pspTransactionId: string,
  ): Promise<Result<CheckoutTransaction, PayTransactionError>> {
    const polled = await this.pollUntilTerminal(pspTransactionId);
    if (!polled.ok) {
      await this.transactions.finalizePay(
        settlement(transaction, {
          pspTransactionId,
          status: "ERROR",
          cardBrand: transaction.cardBrand,
          cardLast4: transaction.cardLast4,
        }),
      );
      return polled;
    }
    return this.finalizeCharge(transaction, polled.value);
  }

  private async finalizeCharge(
    transaction: CheckoutTransaction,
    charge: PspCharge,
  ): Promise<Result<CheckoutTransaction, PayTransactionError>> {
    const finalized = await this.transactions.finalizePay(
      settlement(transaction, charge),
    );
    if (!finalized) {
      return err(transactionNotFound(transaction.id));
    }
    return ok(finalized);
  }

  private async pollUntilTerminal(
    pspTransactionId: string,
  ): Promise<Result<PspCharge, PspTimeoutError>> {
    for (let attempt = 0; attempt < this.settings.pollMaxAttempts; attempt++) {
      if (attempt > 0) {
        await this.settings.sleep(this.settings.pollIntervalMs);
      }
      const result = await this.gateway.getChargeStatus(pspTransactionId);
      if (result.ok && result.value.status !== "PENDING") {
        return ok(result.value);
      }
    }
    return err(pspTimeout());
  }
}

function readPayTokens(
  input: PayTransactionInput,
): Result<
  {
    paymentToken: string;
    acceptanceToken: string;
    acceptPersonalAuth?: string;
    installments: number;
  },
  PaymentValidationError
> {
  if (!isNonEmptyString(input.paymentToken)) {
    return err(paymentValidationError("paymentToken is required"));
  }
  if (!isNonEmptyString(input.acceptanceToken)) {
    return err(paymentValidationError("acceptanceToken is required"));
  }
  let acceptPersonalAuth: string | undefined;
  if (input.acceptPersonalAuth !== undefined && input.acceptPersonalAuth !== null) {
    if (!isNonEmptyString(input.acceptPersonalAuth)) {
      return err(paymentValidationError("acceptPersonalAuth is invalid"));
    }
    acceptPersonalAuth = input.acceptPersonalAuth.trim();
  }
  const installments =
    input.installments === undefined || input.installments === null
      ? 1
      : input.installments;
  if (
    typeof installments !== "number" ||
    !Number.isInteger(installments) ||
    installments < 1
  ) {
    return err(paymentValidationError("installments must be an integer >= 1"));
  }
  return ok({
    paymentToken: input.paymentToken.trim(),
    acceptanceToken: input.acceptanceToken.trim(),
    acceptPersonalAuth,
    installments,
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function settlement(
  transaction: CheckoutTransaction,
  charge: Pick<PspCharge, "pspTransactionId" | "cardBrand" | "cardLast4" | "status">,
) {
  return {
    id: transaction.id,
    status: toSettlementStatus(charge.status),
    pspTransactionId: charge.pspTransactionId,
    cardBrand: charge.cardBrand,
    cardLast4: charge.cardLast4,
    productId: transaction.productId,
    quantity: transaction.quantity,
    deliveryId: transaction.deliveryId,
  };
}

function toSettlementStatus(
  status: PspCharge["status"] | "ERROR",
):
  | typeof TRANSACTION_STATUS_APPROVED
  | typeof TRANSACTION_STATUS_DECLINED
  | typeof TRANSACTION_STATUS_ERROR {
  if (status === "APPROVED") {
    return TRANSACTION_STATUS_APPROVED;
  }
  if (status === "ERROR") {
    return TRANSACTION_STATUS_ERROR;
  }
  return TRANSACTION_STATUS_DECLINED;
}
