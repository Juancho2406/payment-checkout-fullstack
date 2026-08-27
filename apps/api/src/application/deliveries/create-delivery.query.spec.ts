import { randomUUID } from "node:crypto";
import type { Customer, CustomerRepository } from "../../domain/customer";
import {
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
} from "../../domain/delivery";
import { CreateDeliveryQuery } from "./create-delivery.query";
import { GetDeliveryQuery } from "./get-delivery.query";

const customer: Customer = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Pérez",
  email: "ana@example.com",
  phone: "+573001112233",
};

class FakeCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: Customer[] = []) {}
  async findById(id: string): Promise<Customer | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async findByEmail(email: string): Promise<Customer | null> {
    return this.rows.find((row) => row.email === email) ?? null;
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

describe("CreateDeliveryQuery", () => {
  it("persists a draft delivery for an existing customer", async () => {
    const deliveries = new FakeDeliveryRepository();
    const query = new CreateDeliveryQuery(
      new FakeCustomerRepository([customer]),
      deliveries,
    );

    const result = await query.execute({
      customerId: customer.id,
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(DELIVERY_STATUS_DRAFT);
      expect(result.value.customerId).toBe(customer.id);
      expect(result.value.city).toBe("Bogotá");
    }
  });

  it("returns NOT_FOUND when the customer is missing", async () => {
    const query = new CreateDeliveryQuery(
      new FakeCustomerRepository(),
      new FakeDeliveryRepository(),
    );
    const result = await query.execute({
      customerId: customer.id,
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns VALIDATION_ERROR when address is empty", async () => {
    const query = new CreateDeliveryQuery(
      new FakeCustomerRepository([customer]),
      new FakeDeliveryRepository(),
    );
    const result = await query.execute({
      customerId: customer.id,
      address: "  ",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns NOT_FOUND when customerId is missing", async () => {
    const query = new CreateDeliveryQuery(
      new FakeCustomerRepository([customer]),
      new FakeDeliveryRepository(),
    );
    const result = await query.execute({
      customerId: "",
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns VALIDATION_ERROR when city, region or postalCode is empty", async () => {
    const query = new CreateDeliveryQuery(
      new FakeCustomerRepository([customer]),
      new FakeDeliveryRepository(),
    );
    const valid = {
      customerId: customer.id,
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
    };
    for (const field of ["city", "region", "postalCode"] as const) {
      const result = await query.execute({ ...valid, [field]: "  " });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    }
  });
});

describe("GetDeliveryQuery", () => {
  it("returns the delivery when it exists", async () => {
    const deliveries = new FakeDeliveryRepository();
    const created = await deliveries.save({
      customerId: customer.id,
      address: "Cra 7 # 12-34",
      city: "Bogotá",
      region: "Cundinamarca",
      postalCode: "110111",
      status: DELIVERY_STATUS_DRAFT,
    });
    const query = new GetDeliveryQuery(deliveries);
    const result = await query.execute(created.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(created.id);
    }
  });

  it("returns NOT_FOUND when missing", async () => {
    const query = new GetDeliveryQuery(new FakeDeliveryRepository());
    const result = await query.execute("00000000-0000-4000-8000-000000000000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
