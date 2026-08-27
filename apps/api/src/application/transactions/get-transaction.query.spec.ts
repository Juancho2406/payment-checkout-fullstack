import { GetTransactionQuery } from "./get-transaction.query";
import {
  TRANSACTION_STATUS_PENDING,
  EMPTY_PSP_DETAILS,
  type CheckoutTransaction,
  type TransactionRepository,
} from "../../domain/transaction";

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

class FakeTransactionRepository implements TransactionRepository {
  constructor(private readonly rows: readonly CheckoutTransaction[]) {}

  async findById(id: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByReference(): Promise<CheckoutTransaction | null> {
    return null;
  }

  async createPending(): Promise<never> {
    throw new Error("not used");
  }

  async attachPspCharge(): Promise<never> {
    throw new Error("not used");
  }

  async finalizePay(): Promise<never> {
    throw new Error("not used");
  }
}

describe("GetTransactionQuery", () => {
  it("returns the transaction when the port finds it", async () => {
    const query = new GetTransactionQuery(
      new FakeTransactionRepository([pending]),
    );

    const result = await query.execute(pending.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(pending);
    }
  });

  it("returns NOT_FOUND when the transaction is missing", async () => {
    const query = new GetTransactionQuery(new FakeTransactionRepository([]));
    const missingId = "00000000-0000-4000-8000-000000000000";

    const result = await query.execute(missingId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "NOT_FOUND",
        message: `Transaction ${missingId} was not found`,
      });
    }
  });
});
