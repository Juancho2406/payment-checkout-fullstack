import { Prisma } from "@prisma/client";
import {
  PrismaTransactionRepository,
  toCheckoutTransaction,
} from "./prisma-transaction.repository";
import { PrismaService } from "./prisma.service";

const now = new Date("2026-08-27T12:00:00.000Z");

const pendingRow = {
  id: "55555555-5555-4555-8555-555555555555",
  reference: "CHK-20260827-AB12CD",
  status: "PENDING" as const,
  productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  customerId: "11111111-1111-4111-8111-111111111111",
  deliveryId: "22222222-2222-4222-8222-222222222222",
  quantity: 1,
  productAmountCents: 19900000,
  baseFeeCents: 500000,
  deliveryFeeCents: 800000,
  totalCents: 21200000,
  currency: "COP",
  pspTransactionId: null,
  cardBrand: null,
  cardLast4: null,
  createdAt: now,
  updatedAt: now,
};

describe("toCheckoutTransaction", () => {
  it("maps a Prisma row to the domain transaction without persistence fields", () => {
    expect(toCheckoutTransaction(pendingRow)).toEqual({
      id: pendingRow.id,
      reference: pendingRow.reference,
      status: "PENDING",
      productId: pendingRow.productId,
      customerId: pendingRow.customerId,
      deliveryId: pendingRow.deliveryId,
      quantity: 1,
      productAmountCents: 19900000,
      baseFeeCents: 500000,
      deliveryFeeCents: 800000,
      totalCents: 21200000,
      currency: "COP",
    });
  });

  it("returns null when deliveryId is missing", () => {
    expect(toCheckoutTransaction({ ...pendingRow, deliveryId: null })).toBeNull();
  });
});

describe("PrismaTransactionRepository", () => {
  it("returns null for an invalid uuid without querying", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn(),
      },
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repository.findById("not-a-uuid")).resolves.toBeNull();
    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
  });

  it("returns stock when the product decrement matches no row", async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          product: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          transaction: {
            create: jest.fn(),
          },
        }),
      ),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repository.createPending({
        reference: pendingRow.reference,
        productId: pendingRow.productId,
        customerId: pendingRow.customerId,
        deliveryId: pendingRow.deliveryId,
        quantity: 1,
        productAmountCents: 19900000,
        baseFeeCents: 500000,
        deliveryFeeCents: 800000,
        totalCents: 21200000,
        currency: "COP",
      }),
    ).resolves.toEqual({ kind: "stock" });
  });

  it("returns reference when Prisma reports a unique violation", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["reference"] },
    });
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(conflict),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repository.createPending({
        reference: pendingRow.reference,
        productId: pendingRow.productId,
        customerId: pendingRow.customerId,
        deliveryId: pendingRow.deliveryId,
        quantity: 1,
        productAmountCents: 19900000,
        baseFeeCents: 500000,
        deliveryFeeCents: 800000,
        totalCents: 21200000,
        currency: "COP",
      }),
    ).resolves.toEqual({ kind: "reference" });
  });
});
