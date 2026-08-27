import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import {
  BASE_FEE_CENTS,
  DELIVERY_FEE_CENTS,
} from "../../domain/checkout";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { CUSTOMER_REPOSITORY } from "../../domain/customer";
import {
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
} from "../../domain/delivery";
import { DELIVERY_REPOSITORY } from "../../domain/delivery";
import type { Product, ProductRepository } from "../../domain/product";
import { PRODUCT_REPOSITORY } from "../../domain/product";
import {
  TRANSACTION_REPOSITORY,
  TRANSACTION_STATUS_PENDING,
  type CheckoutTransaction,
  type CreatePendingOutcome,
  type NewPendingTransaction,
  type TransactionRepository,
} from "../../domain/transaction";
import { configureHttp } from "./configure-http";

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
  constructor(readonly catalog: Product[]) {}

  async findAll(): Promise<readonly Product[]> {
    return this.catalog;
  }

  async findById(id: string): Promise<Product | null> {
    return this.catalog.find((product) => product.id === id) ?? null;
  }

  async reserveStock(id: string, quantity: number): Promise<boolean> {
    const index = this.catalog.findIndex((product) => product.id === id);
    const product = this.catalog[index];
    if (!product || product.stock < quantity) {
      return false;
    }
    this.catalog[index] = { ...product, stock: product.stock - quantity };
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
  readonly rows: CheckoutTransaction[] = [];

  constructor(private readonly products: FakeProductRepository) {}

  async findById(id: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByReference(reference: string): Promise<CheckoutTransaction | null> {
    return this.rows.find((row) => row.reference === reference) ?? null;
  }

  async createPending(
    input: NewPendingTransaction,
  ): Promise<CreatePendingOutcome> {
    if (this.rows.some((row) => row.reference === input.reference)) {
      return { kind: "reference" };
    }
    if (this.rows.some((row) => row.deliveryId === input.deliveryId)) {
      return { kind: "delivery" };
    }
    const reserved = await this.products.reserveStock(
      input.productId,
      input.quantity,
    );
    if (!reserved) {
      return { kind: "stock" };
    }
    const transaction: CheckoutTransaction = {
      id: randomUUID(),
      status: TRANSACTION_STATUS_PENDING,
      ...input,
    };
    this.rows.push(transaction);
    return { kind: "created", transaction };
  }
}

describe("transactions HTTP", () => {
  let app: INestApplication;
  const products = new FakeProductRepository([{ ...headphones }]);
  const deliveries = new FakeDeliveryRepository([{ ...delivery }]);
  const transactions = new FakeTransactionRepository(products);

  beforeAll(async () => {
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
      .compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const body = {
    productId: headphones.id,
    quantity: 1,
    customerId: customer.id,
    deliveryId: delivery.id,
  };

  it("POST /transactions returns 201 PENDING and GET returns the same resource", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send(body)
      .expect(201);

    expect(created.body).toMatchObject({
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
    });
    expect(created.body.reference).toMatch(/^CHK-\d{8}-[0-9A-F]{6}$/);
    expect(products.catalog[0]?.stock).toBe(6);
    expect(deliveries.rows[0]?.status).toBe(DELIVERY_STATUS_DRAFT);

    await request(app.getHttpServer())
      .get(`/api/v1/transactions/${created.body.id}`)
      .expect(200)
      .expect(created.body);
  });

  it("POST /transactions returns 201 with server totals even if the client sends totalCents", async () => {
    const extraDelivery: Delivery = {
      ...delivery,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    deliveries.rows.push(extraDelivery);

    const created = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({
        productId: headphones.id,
        quantity: 1,
        customerId: customer.id,
        deliveryId: extraDelivery.id,
        totalCents: 1,
      })
      .expect(201);

    expect(created.body.totalCents).toBe(21200000);
  });

  it("POST /transactions returns 409 STOCK_UNAVAILABLE when quantity exceeds stock", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({ ...body, quantity: 80 })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe("STOCK_UNAVAILABLE");
      });
  });

  it("POST /transactions returns 409 CONFLICT when the reference is duplicated", async () => {
    const reference = "CHK-20260827-DUP001";
    const firstDelivery: Delivery = {
      ...delivery,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    };
    const secondDelivery: Delivery = {
      ...delivery,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    };
    deliveries.rows.push(firstDelivery, secondDelivery);

    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({
        ...body,
        deliveryId: firstDelivery.id,
        reference,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({
        ...body,
        deliveryId: secondDelivery.id,
        reference,
      })
      .expect(409)
      .expect({
        error: {
          code: "CONFLICT",
          message: `Reference ${reference} is already in use`,
        },
      });
  });

  it("POST /transactions returns 400 INVALID_QUANTITY when quantity is invalid", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({ ...body, quantity: 0 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("INVALID_QUANTITY");
      });
  });

  it("POST /transactions returns 404 when the product is missing", async () => {
    const missingId = "00000000-0000-4000-8000-000000000000";
    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({ ...body, productId: missingId })
      .expect(404)
      .expect({
        error: {
          code: "NOT_FOUND",
          message: `Product ${missingId} was not found`,
        },
      });
  });

  it("POST /transactions returns 400 when delivery does not belong to the customer", async () => {
    const foreign: Delivery = {
      ...delivery,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      customerId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    };
    deliveries.rows.push(foreign);

    await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .send({ ...body, deliveryId: foreign.id })
      .expect(400)
      .expect({
        error: {
          code: "VALIDATION_ERROR",
          message: "deliveryId does not belong to customerId",
        },
      });
  });

  it("GET /transactions/:id returns 404 when missing", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/transactions/00000000-0000-4000-8000-000000000000")
      .expect(404);
  });
});
