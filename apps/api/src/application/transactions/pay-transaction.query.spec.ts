import type { Customer, CustomerRepository } from "../../domain/customer";
import {
  integritySignature,
  pspDeclined,
  type CreateChargeInput,
  type PaymentGateway,
  type PaymentSettings,
  type PspCharge,
  type PspDeclinedError,
} from "../../domain/payment";
import { err, ok, type Result } from "../../domain/result";
import {
  EMPTY_PSP_DETAILS,
  TRANSACTION_STATUS_APPROVED,
  TRANSACTION_STATUS_DECLINED,
  TRANSACTION_STATUS_ERROR,
  TRANSACTION_STATUS_PENDING,
  type AttachPspChargeInput,
  type CheckoutTransaction,
  type CreatePendingOutcome,
  type FinalizePayInput,
  type TransactionRepository,
} from "../../domain/transaction";
import { PayTransactionQuery } from "./pay-transaction.query";

const pending: CheckoutTransaction = {
  id: "55555555-5555-4555-8555-555555555555",
  reference: "CHK-20260827-AB12CD",
  status: TRANSACTION_STATUS_PENDING,
  productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  customerId: "11111111-1111-4111-8111-111111111111",
  deliveryId: "22222222-2222-4222-8222-222222222222",
  quantity: 1,
  productAmountCents: 19900000,
  baseFeeCents: 500000,
  deliveryFeeCents: 800000,
  totalCents: 21200000,
  currency: "COP",
  ...EMPTY_PSP_DETAILS,
};

const customer: Customer = {
  id: pending.customerId,
  fullName: "Ana Pérez",
  email: "ana@example.com",
  phone: "+573001112233",
};

const approvedCharge: PspCharge = {
  pspTransactionId: "psp-approved-1",
  status: "APPROVED",
  cardBrand: "VISA",
  cardLast4: "4242",
};

const payBody = {
  transactionId: pending.id,
  paymentToken: "tok_test_visa",
  acceptanceToken: "eyJ-acceptance",
  acceptPersonalAuth: "eyJ-personal",
  installments: 1,
};

class FakeCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: readonly Customer[]) {}
  async findById(id: string): Promise<Customer | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async findByEmail(): Promise<Customer | null> {
    return null;
  }
  async save(): Promise<Customer> {
    throw new Error("not used");
  }
}

class FakeTransactionRepository implements TransactionRepository {
  constructor(readonly rows: CheckoutTransaction[]) {}
  released: { productId: string; quantity: number }[] = [];
  assigned: string[] = [];

  async findById(id: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async findByReference(): Promise<CheckoutTransaction | null> {
    return null;
  }
  async createPending(): Promise<CreatePendingOutcome> {
    throw new Error("not used");
  }
  async attachPspCharge(
    id: string,
    charge: AttachPspChargeInput,
  ): Promise<CheckoutTransaction | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const updated = { ...this.rows[index], ...charge };
    this.rows[index] = updated;
    return updated;
  }
  async finalizePay(input: FinalizePayInput): Promise<CheckoutTransaction | null> {
    const index = this.rows.findIndex((row) => row.id === input.id);
    if (index < 0) return null;
    if (input.status === TRANSACTION_STATUS_DECLINED) {
      this.released.push({
        productId: input.productId,
        quantity: input.quantity,
      });
    }
    if (input.status === TRANSACTION_STATUS_APPROVED) {
      this.assigned.push(input.deliveryId);
    }
    const updated: CheckoutTransaction = {
      ...this.rows[index],
      status: input.status,
      pspTransactionId: input.pspTransactionId,
      cardBrand: input.cardBrand,
      cardLast4: input.cardLast4,
    };
    this.rows[index] = updated;
    return updated;
  }
}

class FakePaymentGateway implements PaymentGateway {
  createCalls = 0;
  lastCreate: CreateChargeInput | undefined;
  createResult: Result<PspCharge, PspDeclinedError> = ok(approvedCharge);
  pollQueue: PspCharge[] = [];

  async createCharge(
    input: CreateChargeInput,
  ): Promise<Result<PspCharge, PspDeclinedError>> {
    this.createCalls += 1;
    this.lastCreate = input;
    return this.createResult;
  }

  async getChargeStatus(): Promise<Result<PspCharge, PspDeclinedError>> {
    const next = this.pollQueue.shift();
    if (!next) {
      return err(pspDeclined("no poll status"));
    }
    return ok(next);
  }
}

const settings: PaymentSettings = {
  integritySecret: "test-integrity-secret",
  pollIntervalMs: 0,
  pollMaxAttempts: 3,
  sleep: async () => undefined,
};

function setup(row: CheckoutTransaction = { ...pending }) {
  const transactions = new FakeTransactionRepository([{ ...row }]);
  const gateway = new FakePaymentGateway();
  const query = new PayTransactionQuery(
    transactions,
    new FakeCustomerRepository([customer]),
    gateway,
    settings,
  );
  return { query, transactions, gateway };
}

describe("PayTransactionQuery", () => {
  it("charges the PSP, assigns delivery, and returns APPROVED", async () => {
    const { query, transactions, gateway } = setup();

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_APPROVED);
      expect(result.value.pspTransactionId).toBe("psp-approved-1");
      expect(result.value.cardBrand).toBe("VISA");
      expect(result.value.cardLast4).toBe("4242");
    }
    expect(gateway.createCalls).toBe(1);
    expect(transactions.assigned).toEqual([pending.deliveryId]);
    expect(transactions.released).toEqual([]);
    expect(gateway.lastCreate?.signature).toBe(
      integritySignature({
        reference: pending.reference,
        amountInCents: pending.totalCents,
        currency: pending.currency,
        secret: settings.integritySecret,
      }),
    );
    expect(gateway.lastCreate?.customerEmail).toBe(customer.email);
    expect(gateway.lastCreate?.amountInCents).toBe(21200000);
  });

  it("polls until APPROVED when createCharge returns PENDING", async () => {
    const { query, gateway } = setup();
    gateway.createResult = ok({
      ...approvedCharge,
      status: "PENDING",
      cardBrand: null,
      cardLast4: null,
    });
    gateway.pollQueue = [approvedCharge];

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_APPROVED);
    }
  });

  it("releases stock and returns DECLINED when the sandbox declines", async () => {
    const { query, transactions, gateway } = setup();
    gateway.createResult = ok({
      ...approvedCharge,
      status: "DECLINED",
    });

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_DECLINED);
    }
    expect(transactions.released).toEqual([
      { productId: pending.productId, quantity: 1 },
    ]);
    expect(transactions.assigned).toEqual([]);
  });

  it("maps VOIDED to DECLINED and releases stock", async () => {
    const { query, transactions, gateway } = setup();
    gateway.createResult = ok({ ...approvedCharge, status: "VOIDED" });

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_DECLINED);
    }
    expect(transactions.released).toHaveLength(1);
  });

  it("returns PSP_TIMEOUT and persists ERROR when polling never terminates", async () => {
    const { query, transactions, gateway } = setup();
    gateway.createResult = ok({
      ...approvedCharge,
      status: "PENDING",
    });
    gateway.pollQueue = [
      { ...approvedCharge, status: "PENDING" },
      { ...approvedCharge, status: "PENDING" },
      { ...approvedCharge, status: "PENDING" },
    ];

    const result = await query.execute(payBody);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PSP_TIMEOUT");
    }
    expect(transactions.rows[0]?.status).toBe(TRANSACTION_STATUS_ERROR);
    expect(transactions.released).toEqual([]);
  });

  it("does not create a second charge when the transaction is already APPROVED", async () => {
    const { query, gateway } = setup({
      ...pending,
      status: TRANSACTION_STATUS_APPROVED,
      pspTransactionId: "psp-approved-1",
      cardBrand: "VISA",
      cardLast4: "4242",
    });

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    expect(gateway.createCalls).toBe(0);
  });

  it("polls an existing pspTransactionId instead of creating a new charge", async () => {
    const { query, gateway } = setup({
      ...pending,
      pspTransactionId: "psp-existing",
    });
    gateway.pollQueue = [approvedCharge];

    const result = await query.execute(payBody);

    expect(result.ok).toBe(true);
    expect(gateway.createCalls).toBe(0);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_APPROVED);
    }
  });

  it("returns PSP_DECLINED when the charge cannot start", async () => {
    const { query, gateway, transactions } = setup();
    gateway.createResult = err(pspDeclined("PSP rejected the charge request"));

    const result = await query.execute(payBody);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PSP_DECLINED");
    }
    expect(transactions.rows[0]?.status).toBe(TRANSACTION_STATUS_PENDING);
  });

  it("returns VALIDATION_ERROR when paymentToken is missing", async () => {
    const { query, gateway } = setup();

    const result = await query.execute({
      ...payBody,
      paymentToken: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(gateway.createCalls).toBe(0);
  });

  it("returns NOT_FOUND when the transaction is missing", async () => {
    const { query } = setup();

    const result = await query.execute({
      ...payBody,
      transactionId: "00000000-0000-4000-8000-000000000000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
