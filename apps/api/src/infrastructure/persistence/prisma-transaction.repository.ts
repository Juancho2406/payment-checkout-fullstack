import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Transaction as TransactionRow } from "@prisma/client";
import { PRODUCT_CURRENCY } from "../../domain/product";
import {
  TRANSACTION_STATUS_APPROVED,
  TRANSACTION_STATUS_DECLINED,
  TRANSACTION_STATUS_ERROR,
  TRANSACTION_STATUS_PENDING,
  type AttachPspChargeInput,
  type CheckoutTransaction,
  type CreatePendingOutcome,
  type FinalizePayInput,
  type NewPendingTransaction,
  type TransactionRepository,
  type TransactionStatus,
} from "../../domain/transaction";
import { DELIVERY_STATUS_ASSIGNED } from "../../domain/delivery";
import { PrismaService } from "./prisma.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class StockRaceError extends Error {
  constructor() {
    super("STOCK_RACE");
    this.name = "StockRaceError";
  }
}

export function toCheckoutTransaction(
  row: TransactionRow,
): CheckoutTransaction | null {
  if (!row.deliveryId) {
    return null;
  }
  return {
    id: row.id,
    reference: row.reference,
    status: toStatus(row.status),
    productId: row.productId,
    customerId: row.customerId,
    deliveryId: row.deliveryId,
    quantity: row.quantity,
    productAmountCents: row.productAmountCents,
    baseFeeCents: row.baseFeeCents,
    deliveryFeeCents: row.deliveryFeeCents,
    totalCents: row.totalCents,
    currency: PRODUCT_CURRENCY,
    pspTransactionId: row.pspTransactionId,
    cardBrand: row.cardBrand,
    cardLast4: row.cardLast4,
  };
}

function toStatus(status: TransactionRow["status"]): TransactionStatus {
  switch (status) {
    case "APPROVED":
      return TRANSACTION_STATUS_APPROVED;
    case "DECLINED":
      return TRANSACTION_STATUS_DECLINED;
    case "ERROR":
      return TRANSACTION_STATUS_ERROR;
    default:
      return TRANSACTION_STATUS_PENDING;
  }
}

function uniqueTargetIncludes(
  error: Prisma.PrismaClientKnownRequestError,
  field: string,
): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item).includes(field));
  }
  return String(target ?? "").includes(field);
}

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CheckoutTransaction | null> {
    if (!UUID_RE.test(id)) {
      return null;
    }
    const row = await this.prisma.transaction.findUnique({ where: { id } });
    return row ? toCheckoutTransaction(row) : null;
  }

  async findByReference(reference: string): Promise<CheckoutTransaction | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { reference },
    });
    return row ? toCheckoutTransaction(row) : null;
  }

  async createPending(
    input: NewPendingTransaction,
  ): Promise<CreatePendingOutcome> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const reserved = await tx.product.updateMany({
          where: { id: input.productId, stock: { gte: input.quantity } },
          data: { stock: { decrement: input.quantity } },
        });
        if (reserved.count !== 1) {
          throw new StockRaceError();
        }
        return tx.transaction.create({
          data: {
            reference: input.reference,
            status: TRANSACTION_STATUS_PENDING,
            productId: input.productId,
            customerId: input.customerId,
            deliveryId: input.deliveryId,
            quantity: input.quantity,
            productAmountCents: input.productAmountCents,
            baseFeeCents: input.baseFeeCents,
            deliveryFeeCents: input.deliveryFeeCents,
            totalCents: input.totalCents,
            currency: input.currency,
          },
        });
      });
      const mapped = toCheckoutTransaction(row);
      if (!mapped) {
        return { kind: "stock" };
      }
      return { kind: "created", transaction: mapped };
    } catch (error) {
      if (error instanceof StockRaceError) {
        return { kind: "stock" };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        if (uniqueTargetIncludes(error, "deliveryId")) {
          return { kind: "delivery" };
        }
        return { kind: "reference" };
      }
      throw error;
    }
  }

  async attachPspCharge(
    id: string,
    charge: AttachPspChargeInput,
  ): Promise<CheckoutTransaction | null> {
    if (!UUID_RE.test(id)) {
      return null;
    }
    const row = await this.prisma.transaction.update({
      where: { id },
      data: {
        pspTransactionId: charge.pspTransactionId,
        cardBrand: charge.cardBrand,
        cardLast4: charge.cardLast4,
      },
    });
    return toCheckoutTransaction(row);
  }

  async finalizePay(input: FinalizePayInput): Promise<CheckoutTransaction | null> {
    if (!UUID_RE.test(input.id)) {
      return null;
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.status === TRANSACTION_STATUS_APPROVED) {
        await tx.delivery.updateMany({
          where: { id: input.deliveryId },
          data: {
            status: DELIVERY_STATUS_ASSIGNED,
            transactionId: input.id,
          },
        });
      }
      if (input.status === TRANSACTION_STATUS_DECLINED) {
        await tx.product.updateMany({
          where: { id: input.productId },
          data: { stock: { increment: input.quantity } },
        });
      }
      return tx.transaction.update({
        where: { id: input.id },
        data: {
          status: input.status,
          pspTransactionId: input.pspTransactionId,
          cardBrand: input.cardBrand,
          cardLast4: input.cardLast4,
        },
      });
    });
    return toCheckoutTransaction(row);
  }
}
