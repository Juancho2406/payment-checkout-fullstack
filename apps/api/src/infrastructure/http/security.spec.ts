import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureHttp } from "./configure-http";
import { OPENAPI_PATH } from "./openapi";
import {
  HSTS_MAX_AGE_SECONDS,
  readCorsOrigins,
} from "./security";

describe("readCorsOrigins", () => {
  it("always includes the local Vite origins and optional extras", () => {
    expect(readCorsOrigins({})).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    expect(
      readCorsOrigins({ CORS_ORIGINS: "https://d111.cloudfront.net" }),
    ).toContain("https://d111.cloudfront.net");
  });
});

describe("security headers", () => {
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

  it("sets Helmet, HSTS, CSP and Permissions-Policy on the API", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toContain(
      `max-age=${HSTS_MAX_AGE_SECONDS}`,
    );
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
  });

  it("allows the SPA origin and rejects others", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .expect(200)
      .expect("access-control-allow-origin", "http://localhost:5173");

    const blocked = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "https://evil.example")
      .expect(200);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps Swagger UI working behind CSP", async () => {
    const response = await request(app.getHttpServer()).get(`/${OPENAPI_PATH}`).expect(200);
    expect(response.text).toContain("swagger-ui");
  });
});
