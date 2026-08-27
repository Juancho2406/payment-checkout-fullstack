import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
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

  async releaseStock(): Promise<boolean> {
    return true;
  }
}

describe("GET /api/v1/products", () => {
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

  it("returns 200 with the catalog wrapped in data", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/products")
      .expect(200)
      .expect({
        data: [
          {
            id: headphones.id,
            name: headphones.name,
            description: headphones.description,
            priceCents: headphones.priceCents,
            currency: "COP",
            stock: headphones.stock,
            imageUrl: headphones.imageUrl,
          },
        ],
      });
  });

  it("returns 200 with the product detail", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/products/${headphones.id}`)
      .expect(200)
      .expect({
        id: headphones.id,
        name: headphones.name,
        description: headphones.description,
        priceCents: headphones.priceCents,
        currency: "COP",
        stock: headphones.stock,
        imageUrl: headphones.imageUrl,
      });
  });

  it("returns 404 NOT_FOUND when the product is missing", async () => {
    const missingId = "00000000-0000-4000-8000-000000000000";

    await request(app.getHttpServer())
      .get(`/api/v1/products/${missingId}`)
      .expect(404)
      .expect({
        error: {
          code: "NOT_FOUND",
          message: `Product ${missingId} was not found`,
        },
      });
  });

  it("returns 404 NOT_FOUND for a non-uuid path", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/products/not-a-uuid")
      .expect(404)
      .expect({
        error: {
          code: "NOT_FOUND",
          message: "Product not-a-uuid was not found",
        },
      });
  });
});
