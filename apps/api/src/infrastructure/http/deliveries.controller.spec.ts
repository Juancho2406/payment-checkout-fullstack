import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { CUSTOMER_REPOSITORY } from "../../domain/customer";
import {
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
} from "../../domain/delivery";
import { DELIVERY_REPOSITORY } from "../../domain/delivery";
import { configureHttp } from "./configure-http";

const customer: Customer = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Pérez",
  email: "ana@example.com",
  phone: "+573001112233",
};

class FakeCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: Customer[]) {}
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
  readonly rows: Delivery[] = [];
  async findById(id: string): Promise<Delivery | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async save(input: {
    readonly customerId: string;
    readonly address: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly status: Delivery["status"];
  }): Promise<Delivery> {
    const created: Delivery = { id: randomUUID(), ...input };
    this.rows.push(created);
    return created;
  }
}

describe("deliveries HTTP", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CUSTOMER_REPOSITORY)
      .useValue(new FakeCustomerRepository([customer]))
      .overrideProvider(DELIVERY_REPOSITORY)
      .useValue(new FakeDeliveryRepository())
      .compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /deliveries returns 201 draft and GET returns it", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/deliveries")
      .send({
        customerId: customer.id,
        address: "Cra 7 # 12-34",
        city: "Bogotá",
        region: "Cundinamarca",
        postalCode: "110111",
      })
      .expect(201);

    expect(created.body.status).toBe(DELIVERY_STATUS_DRAFT);

    await request(app.getHttpServer())
      .get(`/api/v1/deliveries/${created.body.id}`)
      .expect(200)
      .expect(created.body);
  });

  it("POST /deliveries returns 404 when the customer is missing", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/deliveries")
      .send({
        customerId: "00000000-0000-4000-8000-000000000000",
        address: "Cra 7 # 12-34",
        city: "Bogotá",
        region: "Cundinamarca",
        postalCode: "110111",
      })
      .expect(404);
  });

  it("GET /deliveries/:id returns 404 when missing", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/deliveries/00000000-0000-4000-8000-000000000000")
      .expect(404);
  });
});
