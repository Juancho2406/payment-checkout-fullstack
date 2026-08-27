import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureHttp } from "./configure-http";
import { OPENAPI_JSON_PATH, OPENAPI_PATH } from "./openapi";

describe("OpenAPI", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves Swagger UI at /docs", async () => {
    const response = await request(app.getHttpServer()).get(`/${OPENAPI_PATH}`).expect(200);
    expect(response.text).toContain("swagger-ui");
  });

  it("exposes the public contract without PAN or CVC", async () => {
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);

    const document = response.body as {
      paths: Record<string, unknown>;
    };
    const paths = Object.keys(document.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/v1/health",
        "/api/v1/products",
        "/api/v1/products/{id}",
        "/api/v1/checkout/quote",
        "/api/v1/customers",
        "/api/v1/customers/{id}",
        "/api/v1/deliveries",
        "/api/v1/deliveries/{id}",
        "/api/v1/transactions",
        "/api/v1/transactions/{id}",
        "/api/v1/transactions/{id}/pay",
      ]),
    );

    const raw = JSON.stringify(document);
    expect(raw).not.toContain("4111111111111111");
    expect(raw.toLowerCase()).not.toMatch(/"cvc"/);
    expect(raw).toContain("paymentToken");
    expect(raw).toContain("Never send PAN");
  });
});
