import { randomUUID } from "node:crypto";
import {
  BASE_FEE_CENTS,
  DELIVERY_FEE_CENTS,
} from "../../domain/checkout";
import type { Customer, CustomerRepository } from "../../domain/customer";
import {
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
} from "../../domain/delivery";
import type { Product, ProductRepository } from "../../domain/product";
import {
  TRANSACTION_STATUS_PENDING,
  EMPTY_PSP_DETAILS,
  type CheckoutTransaction,
  type CreatePendingOutcome,
  type NewPendingTransaction,
  type TransactionRepository,
} from "../../domain/transaction";
import { CreatePendingTransactionQuery } from "./create-pending-transaction.query";

const headphones: Product = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 19900000,
  stock: 7,
  imageUrl: "https://example.com/headphones.jpg",
};

const customer: Customer = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Pérez",
  email: "ana@example.com",
  phone: "+573001112233",
};

const delivery: Delivery = {
  id: "22222222-2222-4222-8222-222222222222",
  customerId: customer.id,
  address: "Cra 7 # 12-34",
  city: "Bogotá",
  region: "Cundinamarca",
  postalCode: "110111",
  status: DELIVERY_STATUS_DRAFT,
};

class FakeProductRepository implements ProductRepository {
  constructor(private readonly catalog: readonly Product[]) {}

  async findAll(): Promise<readonly Product[]> {
    return this.catalog;
  }

  async findById(id: string): Promise<Product | null> {
    return this.catalog.find((product) => product.id === id) ?? null;
  }

  async reserveStock(): Promise<boolean> {
    return true;
  }

  async releaseStock(): Promise<boolean> {
    return true;
  }
}

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

class FakeDeliveryRepository implements DeliveryRepository {
  constructor(private readonly rows: readonly Delivery[]) {}

  async findById(id: string): Promise<Delivery | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async save(): Promise<Delivery> {
    throw new Error("not used");
  }
}

class FakeTransactionRepository implements TransactionRepository {
  readonly rows: CheckoutTransaction[] = [];
  nextOutcome: CreatePendingOutcome["kind"] | null = null;

  async findById(id: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByReference(reference: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.reference === reference) ?? null;
  }

  async createPending(
    input: NewPendingTransaction,
  ): Promise<CreatePendingOutcome> {
    if (this.nextOutcome === "stock") {
      return { kind: "stock" };
    }
    if (this.nextOutcome === "reference") {
      return { kind: "reference" };
    }
    if (this.nextOutcome === "delivery") {
      return { kind: "delivery" };
    }
    const transaction: CheckoutTransaction = {
      id: randomUUID(),
      status: TRANSACTION_STATUS_PENDING,
      ...EMPTY_PSP_DETAILS,
      ...input,
    };
    this.rows.push(transaction);
    return { kind: "created", transaction };
  }

  async attachPspCharge(): Promise<CheckoutTransaction | null> {
    throw new Error("not used");
  }

  async tryClaimCharge(): Promise<never> {
    throw new Error("not used");
  }

  async releaseChargeClaim(): Promise<never> {
    throw new Error("not used");
  }

  async finalizePay(): Promise<CheckoutTransaction | null> {
    throw new Error("not used");
  }
}

function query(transactions = new FakeTransactionRepository()) {
  return {
    transactions,
    query: new CreatePendingTransactionQuery(
      new FakeProductRepository([headphones]),
      new FakeCustomerRepository([customer]),
      new FakeDeliveryRepository([delivery]),
      transactions,
    ),
  };
}

const validInput = {
  productId: headphones.id,
  quantity: 1,
  customerId: customer.id,
  deliveryId: delivery.id,
};

describe("CreatePendingTransactionQuery", () => {
  it("creates PENDING with server-owned totals and a generated reference", async () => {
    const { query: create, transactions } = query();

    const result = await create.execute(validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(TRANSACTION_STATUS_PENDING);
      expect(result.value.productAmountCents).toBe(19900000);
      expect(result.value.baseFeeCents).toBe(BASE_FEE_CENTS);
      expect(result.value.deliveryFeeCents).toBe(DELIVERY_FEE_CENTS);
      expect(result.value.totalCents).toBe(21200000);
      expect(result.value.currency).toBe("COP");
      expect(result.value.reference).toMatch(/^CHK-\d{8}-[0-9A-F]{6}$/);
      expect(transactions.rows).toHaveLength(1);
    }
  });

  it("uses a client reference when it is unique", async () => {
    const { query: create } = query();

    const result = await create.execute({
      ...validInput,
      reference: "CHK-20260827-CLIENT",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reference).toBe("CHK-20260827-CLIENT");
    }
  });

  it("ignores a client-sent total and recomputes from the catalog", async () => {
    const { query: create } = query();

    const result = await create.execute({
      ...validInput,
      ...{ totalCents: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCents).toBe(21200000);
    }
  });

  it("returns CONFLICT when the reference already exists", async () => {
    const { query: create, transactions } = query();
    transactions.rows.push({
      id: randomUUID(),
      reference: "CHK-DUP-1",
      status: TRANSACTION_STATUS_PENDING,
      productId: headphones.id,
      customerId: customer.id,
      deliveryId: delivery.id,
      quantity: 1,
      productAmountCents: 19900000,
      baseFeeCents: BASE_FEE_CENTS,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: 21200000,
      currency: "COP",
      ...EMPTY_PSP_DETAILS,
    });

    const result = await create.execute({
      ...validInput,
      reference: "CHK-DUP-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("returns STOCK_UNAVAILABLE when quantity exceeds stock", async () => {
    const { query: create } = query();

    const result = await create.execute({ ...validInput, quantity: 8 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "STOCK_UNAVAILABLE",
        message: "Requested 8 but only 7 in stock",
      });
    }
  });

  it("returns STOCK_UNAVAILABLE when the reserve loses the race", async () => {
    const { query: create, transactions } = query();
    transactions.nextOutcome = "stock";

    const result = await create.execute(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STOCK_UNAVAILABLE");
    }
  });

  it("returns CONFLICT when the delivery is already linked", async () => {
    const { query: create, transactions } = query();
    transactions.nextOutcome = "delivery";

    const result = await create.execute(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("returns VALIDATION_ERROR when delivery does not belong to the customer", async () => {
    const { query: create } = query();

    const result = await create.execute({
      ...validInput,
      deliveryId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns VALIDATION_ERROR when delivery belongs to another customer", async () => {
    const otherDelivery: Delivery = {
      ...delivery,
      id: "33333333-3333-4333-8333-333333333333",
      customerId: "44444444-4444-4444-8444-444444444444",
    };
    const create = new CreatePendingTransactionQuery(
      new FakeProductRepository([headphones]),
      new FakeCustomerRepository([customer]),
      new FakeDeliveryRepository([otherDelivery]),
      new FakeTransactionRepository(),
    );

    const result = await create.execute({
      ...validInput,
      deliveryId: otherDelivery.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "deliveryId does not belong to customerId",
      });
    }
  });

  it("returns INVALID_QUANTITY when quantity is not a positive integer", async () => {
    const { query: create } = query();

    const result = await create.execute({ ...validInput, quantity: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_QUANTITY");
    }
  });

  it("returns NOT_FOUND when the product is missing", async () => {
    const { query: create } = query();
    const missingId = "00000000-0000-4000-8000-000000000000";

    const result = await create.execute({ ...validInput, productId: missingId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns NOT_FOUND when productId, customerId or deliveryId is empty", async () => {
    const { query: create } = query();
    for (const field of ["productId", "customerId", "deliveryId"] as const) {
      const result = await create.execute({ ...validInput, [field]: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    }
  });

  it("returns NOT_FOUND when the customer is missing", async () => {
    const { query: create } = query();
    const result = await create.execute({
      ...validInput,
      customerId: "00000000-0000-4000-8000-000000000000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns CONFLICT when the repository reports a reference race", async () => {
    const { query: create, transactions } = query();
    transactions.nextOutcome = "reference";
    const result = await create.execute(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("returns VALIDATION_ERROR when the client reference is not a string", async () => {
    const { query: create } = query();
    const result = await create.execute({ ...validInput, reference: 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns VALIDATION_ERROR when the client reference is too long", async () => {
    const { query: create } = query();
    const result = await create.execute({
      ...validInput,
      reference: "x".repeat(256),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("generates a reference when the client sends an empty string", async () => {
    const { query: create } = query();
    const result = await create.execute({ ...validInput, reference: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reference).toMatch(/^CHK-\d{8}-[0-9A-F]{6}$/);
    }
  });
});
