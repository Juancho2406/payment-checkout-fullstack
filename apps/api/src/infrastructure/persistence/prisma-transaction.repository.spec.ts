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

const pendingInput = {
  reference: pendingRow.reference,
  productId: pendingRow.productId,
  customerId: pendingRow.customerId,
  deliveryId: pendingRow.deliveryId,
  quantity: 1,
  productAmountCents: 19900000,
  baseFeeCents: 500000,
  deliveryFeeCents: 800000,
  totalCents: 21200000,
  currency: "COP" as const,
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
      pspTransactionId: null,
      cardBrand: null,
      cardLast4: null,
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
      repository.createPending(pendingInput),
    ).resolves.toEqual({ kind: "reference" });
  });

  it("returns delivery when the unique target is deliveryId", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: "Transaction_deliveryId_key" },
    });
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(conflict),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.createPending(pendingInput)).resolves.toEqual({
      kind: "delivery",
    });
  });

  it("creates PENDING when stock is reserved", async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          product: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue(pendingRow),
          },
        }),
      ),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.createPending(pendingInput)).resolves.toMatchObject({
      kind: "created",
      transaction: { id: pendingRow.id, status: "PENDING" },
    });
  });

  it("maps APPROVED, DECLINED and ERROR rows", () => {
    expect(toCheckoutTransaction({ ...pendingRow, status: "APPROVED" })?.status).toBe(
      "APPROVED",
    );
    expect(toCheckoutTransaction({ ...pendingRow, status: "DECLINED" })?.status).toBe(
      "DECLINED",
    );
    expect(toCheckoutTransaction({ ...pendingRow, status: "ERROR" })?.status).toBe(
      "ERROR",
    );
  });

  it("finds by id and reference", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue(pendingRow),
      },
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(pendingRow.id)).resolves.toMatchObject({
      id: pendingRow.id,
    });
    await expect(
      repository.findByReference(pendingRow.reference),
    ).resolves.toMatchObject({ id: pendingRow.id });
  });

  it("returns null when findById uuid is missing from the table", async () => {
    const prisma = {
      transaction: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(pendingRow.id)).resolves.toBeNull();
  });

  it("attaches a PSP charge and skips invalid ids", async () => {
    const prisma = {
      transaction: {
        update: jest.fn().mockResolvedValue({
          ...pendingRow,
          pspTransactionId: "psp-1",
          cardBrand: "VISA",
          cardLast4: "4242",
        }),
      },
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.attachPspCharge("not-a-uuid", {
        pspTransactionId: "psp-1",
        cardBrand: "VISA",
        cardLast4: "4242",
      }),
    ).resolves.toBeNull();
    await expect(
      repository.attachPspCharge(pendingRow.id, {
        pspTransactionId: "psp-1",
        cardBrand: "VISA",
        cardLast4: "4242",
      }),
    ).resolves.toMatchObject({ pspTransactionId: "psp-1" });
  });

  it("finalizes APPROVED by assigning delivery", async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          delivery: { updateMany: jest.fn() },
          product: { updateMany: jest.fn() },
          transaction: {
            update: jest.fn().mockResolvedValue({
              ...pendingRow,
              status: "APPROVED",
            }),
          },
        }),
      ),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.finalizePay({
        id: pendingRow.id,
        status: "APPROVED",
        pspTransactionId: "psp-1",
        cardBrand: "VISA",
        cardLast4: "4242",
        productId: pendingRow.productId,
        quantity: 1,
        deliveryId: pendingRow.deliveryId,
      }),
    ).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("finalizes DECLINED by releasing stock", async () => {
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          delivery: { updateMany: jest.fn() },
          product: { updateMany: jest.fn() },
          transaction: {
            update: jest.fn().mockResolvedValue({
              ...pendingRow,
              status: "DECLINED",
            }),
          },
        }),
      ),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.finalizePay({
        id: pendingRow.id,
        status: "DECLINED",
        pspTransactionId: "psp-1",
        cardBrand: "VISA",
        cardLast4: "4242",
        productId: pendingRow.productId,
        quantity: 1,
        deliveryId: pendingRow.deliveryId,
      }),
    ).resolves.toMatchObject({ status: "DECLINED" });
  });

  it("returns null for finalizePay with an invalid uuid", async () => {
    const repository = new PrismaTransactionRepository(
      {} as unknown as PrismaService,
    );
    await expect(
      repository.finalizePay({
        id: "not-a-uuid",
        status: "ERROR",
        pspTransactionId: null,
        cardBrand: null,
        cardLast4: null,
        productId: pendingRow.productId,
        quantity: 1,
        deliveryId: pendingRow.deliveryId,
      }),
    ).resolves.toBeNull();
  });

  it("rethrows unexpected createPending errors", async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error("boom")),
    };
    const repository = new PrismaTransactionRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.createPending(pendingInput)).rejects.toThrow("boom");
  });
});
