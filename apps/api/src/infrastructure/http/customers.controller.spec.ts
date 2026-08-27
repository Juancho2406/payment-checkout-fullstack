import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { CUSTOMER_REPOSITORY } from "../../domain/customer";
import { configureHttp } from "./configure-http";

class FakeCustomerRepository implements CustomerRepository {
  readonly rows: Customer[] = [];

  async findById(id: string): Promise<Customer | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.rows.find((row) => row.email === email) ?? null;
  }

  async save(customer: {
    readonly id?: string;
    readonly fullName: string;
    readonly email: string;
    readonly phone: string;
  }): Promise<Customer> {
    if (customer.id) {
      const index = this.rows.findIndex((row) => row.id === customer.id);
      const updated: Customer = {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      };
      if (index >= 0) this.rows[index] = updated;
      return updated;
    }
    const created: Customer = {
      id: randomUUID(),
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    };
    this.rows.push(created);
    return created;
  }
}

describe("customers HTTP", () => {
  let app: INestApplication;
  const customers = new FakeCustomerRepository();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CUSTOMER_REPOSITORY)
      .useValue(customers)
      .compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /customers returns 201 and GET returns the same customer", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .send({
        fullName: "Ana Pérez",
        email: "ana@example.com",
        phone: "+573001112233",
      })
      .expect(201);

    expect(created.body.email).toBe("ana@example.com");

    await request(app.getHttpServer())
      .get(`/api/v1/customers/${created.body.id}`)
      .expect(200)
      .expect(created.body);
  });

  it("POST /customers returns 400 VALIDATION_ERROR for a bad phone", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/customers")
      .send({
        fullName: "Ana Pérez",
        email: "ana2@example.com",
        phone: "123",
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("GET /customers/:id returns 404 when missing", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/customers/00000000-0000-4000-8000-000000000000")
      .expect(404);
  });
});
