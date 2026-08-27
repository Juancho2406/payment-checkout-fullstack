import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import {
  BASE_FEE_CENTS,
  DELIVERY_FEE_CENTS,
} from "../../domain/checkout";
import type { Product, ProductRepository } from "../../domain/product";
import { PRODUCT_REPOSITORY } from "../../domain/product";
import { configureHttp } from "./configure-http";

const headphones: Product = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 19900000,
  stock: 7,
  imageUrl: "https://example.com/headphones.jpg",
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
}

describe("POST /api/v1/checkout/quote", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_REPOSITORY)
      .useValue(new FakeProductRepository([headphones]))
      .compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with server-side totals", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/checkout/quote")
      .send({ productId: headphones.id, quantity: 1 })
      .expect(200)
      .expect({
        productId: headphones.id,
        quantity: 1,
        productAmountCents: 19900000,
        baseFeeCents: BASE_FEE_CENTS,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: 21200000,
        currency: "COP",
        stock: 7,
      });
  });

  it("returns 404 when the product is missing", async () => {
    const missingId = "00000000-0000-4000-8000-000000000000";
    await request(app.getHttpServer())
      .post("/api/v1/checkout/quote")
      .send({ productId: missingId, quantity: 1 })
      .expect(404)
      .expect({
        error: {
          code: "NOT_FOUND",
          message: `Product ${missingId} was not found`,
        },
      });
  });

  it("returns 400 INVALID_QUANTITY when quantity is invalid", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/checkout/quote")
      .send({ productId: headphones.id, quantity: 0 })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("INVALID_QUANTITY");
      });
  });

  it("returns 409 STOCK_UNAVAILABLE when quantity exceeds stock", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/checkout/quote")
      .send({ productId: headphones.id, quantity: 8 })
      .expect(409)
      .expect({
        error: {
          code: "STOCK_UNAVAILABLE",
          message: "Requested 8 but only 7 in stock",
        },
      });
  });

  it("ignores a client-sent total", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/checkout/quote")
      .send({
        productId: headphones.id,
        quantity: 1,
        totalCents: 1,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.totalCents).toBe(21200000);
      });
  });
});
