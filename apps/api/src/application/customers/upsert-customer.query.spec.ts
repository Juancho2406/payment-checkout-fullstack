import { randomUUID } from "node:crypto";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { GetCustomerQuery, UpsertCustomerQuery } from "./upsert-customer.query";

class FakeCustomerRepository implements CustomerRepository {
  constructor(private readonly rows: Customer[] = []) {}

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
      if (index >= 0) {
        this.rows[index] = updated;
      }
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

describe("UpsertCustomerQuery", () => {
  it("creates a customer with a normalized email", async () => {
    const repo = new FakeCustomerRepository();
    const query = new UpsertCustomerQuery(repo);

    const result = await query.execute({
      fullName: "Ana Pérez",
      email: "Ana@Example.com",
      phone: "+573001112233",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe("ana@example.com");
      expect(result.value.fullName).toBe("Ana Pérez");
      expect(result.value.phone).toBe("+573001112233");
    }
  });

  it("reuses the same id when the email already exists", async () => {
    const repo = new FakeCustomerRepository();
    const query = new UpsertCustomerQuery(repo);
    const first = await query.execute({
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "+573001112233",
    });
    const second = await query.execute({
      fullName: "Ana P.",
      email: "ana@example.com",
      phone: "3001112233",
    });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.id).toBe(first.value.id);
      expect(second.value.fullName).toBe("Ana P.");
    }
  });

  it("returns VALIDATION_ERROR for a bad email", async () => {
    const query = new UpsertCustomerQuery(new FakeCustomerRepository());
    const result = await query.execute({
      fullName: "Ana Pérez",
      email: "not-an-email",
      phone: "+573001112233",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns VALIDATION_ERROR when fullName or phone is not a string", async () => {
    const query = new UpsertCustomerQuery(new FakeCustomerRepository());
    const badName = await query.execute({
      fullName: 1,
      email: "ana@example.com",
      phone: "+573001112233",
    });
    const badPhone = await query.execute({
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: 3001112233,
    });
    expect(badName.ok).toBe(false);
    expect(badPhone.ok).toBe(false);
  });
});

describe("GetCustomerQuery", () => {
  it("returns the customer when it exists", async () => {
    const row: Customer = {
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "+573001112233",
    };
    const query = new GetCustomerQuery(new FakeCustomerRepository([row]));
    const result = await query.execute(row.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe(row.email);
    }
  });

  it("returns NOT_FOUND when missing", async () => {
    const query = new GetCustomerQuery(new FakeCustomerRepository());
    const result = await query.execute("00000000-0000-4000-8000-000000000000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
