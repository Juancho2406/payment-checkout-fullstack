import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { CUSTOMER_REPOSITORY } from "../../domain/customer";
import {
  DELIVERY_STATUS_ASSIGNED,
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
} from "../../domain/delivery";
import { DELIVERY_REPOSITORY } from "../../domain/delivery";
import {
  PAYMENT_GATEWAY,
  PAYMENT_SETTINGS,
  pspDeclined,
  type PaymentGateway,
  type PaymentSettings,
  type PspCharge,
  type PspDeclinedError,
} from "../../domain/payment";
import type { Product, ProductRepository } from "../../domain/product";
import { PRODUCT_REPOSITORY } from "../../domain/product";
import { err, ok, type Result } from "../../domain/result";
import {
  EMPTY_PSP_DETAILS,
  TRANSACTION_REPOSITORY,
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
import { configureHttp } from "./configure-http";

const product: Product = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 19900000,
  stock: 6,
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

const pending: CheckoutTransaction = {
  id: "55555555-5555-4555-8555-555555555555",
  reference: "CHK-20260827-AB12CD",
  status: TRANSACTION_STATUS_PENDING,
  productId: product.id,
  customerId: customer.id,
  deliveryId: delivery.id,
  quantity: 1,
  productAmountCents: 19900000,
  baseFeeCents: 500000,
  deliveryFeeCents: 800000,
  totalCents: 21200000,
  currency: "COP",
  ...EMPTY_PSP_DETAILS,
};

class FakeProductRepository implements ProductRepository {
  constructor(readonly catalog: Product[]) {}
  async findAll(): Promise<readonly Product[]> {
    return this.catalog;
  }
  async findById(id: string): Promise<Product | null> {
    return this.catalog.find((row) => row.id === id) ?? null;
  }
  async reserveStock(): Promise<boolean> {
    return true;
  }
  async releaseStock(id: string, quantity: number): Promise<boolean> {
    const index = this.catalog.findIndex((row) => row.id === id);
    const row = this.catalog[index];
    if (!row) return false;
    this.catalog[index] = { ...row, stock: row.stock + quantity };
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
  constructor(readonly rows: Delivery[]) {}
  async findById(id: string): Promise<Delivery | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async save(): Promise<Delivery> {
    throw new Error("not used");
  }
}

class FakeTransactionRepository implements TransactionRepository {
  constructor(
    readonly rows: CheckoutTransaction[],
    private readonly products: FakeProductRepository,
    private readonly deliveries: FakeDeliveryRepository,
  ) {}

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
  async tryClaimCharge(id: string) {
    const row = this.rows.find((item) => item.id === id) ?? null;
    if (!row || row.pspTransactionId || row.status !== TRANSACTION_STATUS_PENDING) {
      return { kind: "unavailable" as const, transaction: row };
    }
    return { kind: "claimed" as const, transaction: row };
  }
  async releaseChargeClaim(): Promise<void> {
    return;
  }
  async finalizePay(input: FinalizePayInput): Promise<CheckoutTransaction | null> {
    const index = this.rows.findIndex((row) => row.id === input.id);
    if (index < 0) return null;
    if (input.status === TRANSACTION_STATUS_DECLINED) {
      await this.products.releaseStock(input.productId, input.quantity);
    }
    if (input.status === TRANSACTION_STATUS_APPROVED) {
      const deliveryIndex = this.deliveries.rows.findIndex(
        (row) => row.id === input.deliveryId,
      );
      if (deliveryIndex >= 0) {
        this.deliveries.rows[deliveryIndex] = {
          ...this.deliveries.rows[deliveryIndex],
          status: DELIVERY_STATUS_ASSIGNED,
        };
      }
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
  createResult: Result<PspCharge, PspDeclinedError> = ok({
    pspTransactionId: "psp-approved-1",
    status: "APPROVED",
    cardBrand: "VISA",
    cardLast4: "4242",
  });
  pollQueue: PspCharge[] = [];

  async createCharge() {
    this.createCalls += 1;
    return this.createResult;
  }

  async getChargeStatus() {
    const next = this.pollQueue.shift();
    if (!next) return err(pspDeclined("empty poll"));
    return ok(next);
  }
}

const payBody = {
  paymentToken: "tok_test_visa",
  acceptanceToken: "eyJ-acceptance",
  acceptPersonalAuth: "eyJ-personal",
  installments: 1,
};

const fastSettings: PaymentSettings = {
  integritySecret: "test-integrity-secret",
  pollIntervalMs: 0,
  pollMaxAttempts: 2,
  sleep: async () => undefined,
};

describe("POST /api/v1/transactions/:id/pay", () => {
  async function startApp(options?: {
    transaction?: CheckoutTransaction;
    gateway?: FakePaymentGateway;
  }) {
    const products = new FakeProductRepository([{ ...product }]);
    const deliveries = new FakeDeliveryRepository([{ ...delivery }]);
    const transactions = new FakeTransactionRepository(
      [{ ...(options?.transaction ?? pending) }],
      products,
      deliveries,
    );
    const gateway = options?.gateway ?? new FakePaymentGateway();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_REPOSITORY)
      .useValue(products)
      .overrideProvider(CUSTOMER_REPOSITORY)
      .useValue(new FakeCustomerRepository([customer]))
      .overrideProvider(DELIVERY_REPOSITORY)
      .useValue(deliveries)
      .overrideProvider(TRANSACTION_REPOSITORY)
      .useValue(transactions)
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway)
      .overrideProvider(PAYMENT_SETTINGS)
      .useValue(fastSettings)
      .compile();

    const app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
    return { app, products, deliveries, gateway, transactions };
  }

  it("returns 200 APPROVED, assigns delivery, and does not re-charge on retry", async () => {
    const { app, deliveries, gateway, products } = await startApp();

    const paid = await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send(payBody)
      .expect(200);

    expect(paid.body).toMatchObject({
      id: pending.id,
      status: TRANSACTION_STATUS_APPROVED,
      pspTransactionId: "psp-approved-1",
      cardBrand: "VISA",
      cardLast4: "4242",
      deliveryId: delivery.id,
      totalCents: 21200000,
      currency: "COP",
    });
    expect(deliveries.rows[0]?.status).toBe(DELIVERY_STATUS_ASSIGNED);
    expect(products.catalog[0]?.stock).toBe(6);
    expect(gateway.createCalls).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send(payBody)
      .expect(200)
      .expect(paid.body);

    expect(gateway.createCalls).toBe(1);
    await app.close();
  });

  it("returns 200 DECLINED and releases reserved stock", async () => {
    const gateway = new FakePaymentGateway();
    gateway.createResult = ok({
      pspTransactionId: "psp-declined-1",
      status: "DECLINED",
      cardBrand: "VISA",
      cardLast4: "4242",
    });
    const { app, products, deliveries } = await startApp({ gateway });

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send(payBody)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(TRANSACTION_STATUS_DECLINED);
      });

    expect(products.catalog[0]?.stock).toBe(7);
    expect(deliveries.rows[0]?.status).toBe(DELIVERY_STATUS_DRAFT);
    await app.close();
  });

  it("returns 503 PSP_TIMEOUT and persists ERROR without releasing stock", async () => {
    const gateway = new FakePaymentGateway();
    gateway.createResult = ok({
      pspTransactionId: "psp-pending-1",
      status: "PENDING",
      cardBrand: null,
      cardLast4: null,
    });
    gateway.pollQueue = [
      {
        pspTransactionId: "psp-pending-1",
        status: "PENDING",
        cardBrand: null,
        cardLast4: null,
      },
      {
        pspTransactionId: "psp-pending-1",
        status: "PENDING",
        cardBrand: null,
        cardLast4: null,
      },
    ];
    const { app, products, transactions } = await startApp({ gateway });

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send(payBody)
      .expect(503)
      .expect((res) => {
        expect(res.body.error.code).toBe("PSP_TIMEOUT");
      });

    expect(transactions.rows[0]?.status).toBe(TRANSACTION_STATUS_ERROR);
    expect(products.catalog[0]?.stock).toBe(6);
    await app.close();
  });

  it("returns 402 when the sandbox cannot start the charge", async () => {
    const gateway = new FakePaymentGateway();
    gateway.createResult = err(pspDeclined("PSP rejected the charge request"));
    const { app } = await startApp({ gateway });

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send(payBody)
      .expect(402)
      .expect((res) => {
        expect(res.body.error.code).toBe("PSP_DECLINED");
      });
    await app.close();
  });

  it("returns 400 when paymentToken is missing", async () => {
    const { app } = await startApp();

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${pending.id}/pay`)
      .send({ acceptanceToken: "eyJ-acceptance" })
      .expect(400);
    await app.close();
  });

  it("returns 404 when the transaction is missing", async () => {
    const { app } = await startApp();

    await request(app.getHttpServer())
      .post("/api/v1/transactions/00000000-0000-4000-8000-000000000000/pay")
      .send(payBody)
      .expect(404);
    await app.close();
  });
});
