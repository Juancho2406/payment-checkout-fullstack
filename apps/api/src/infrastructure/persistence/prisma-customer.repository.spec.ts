import { toCustomer } from "./prisma-customer.repository";
import { PrismaCustomerRepository } from "./prisma-customer.repository";
import { PrismaService } from "./prisma.service";

describe("toCustomer", () => {
  it("maps a Prisma row without timestamps", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    expect(
      toCustomer({
        id: "11111111-1111-4111-8111-111111111111",
        fullName: "Ana Pérez",
        email: "ana@example.com",
        phone: "+573001112233",
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "+573001112233",
    });
  });
});

describe("PrismaCustomerRepository", () => {
  it("returns null for an invalid uuid without querying", async () => {
    const prisma = {
      customer: { findUnique: jest.fn() },
    };
    const repository = new PrismaCustomerRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById("not-a-uuid")).resolves.toBeNull();
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  const uuid = "11111111-1111-4111-8111-111111111111";
  const row = {
    id: uuid,
    fullName: "Ana Pérez",
    email: "ana@example.com",
    phone: "+573001112233",
    createdAt: new Date("2026-08-27T12:00:00.000Z"),
    updatedAt: new Date("2026-08-27T12:00:00.000Z"),
  };

  it("returns the customer by id and by email", async () => {
    const prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(row) },
    };
    const repository = new PrismaCustomerRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(uuid)).resolves.toEqual({
      id: uuid,
      fullName: "Ana Pérez",
      email: "ana@example.com",
      phone: "+573001112233",
    });
    await expect(repository.findByEmail("ana@example.com")).resolves.toMatchObject({
      id: uuid,
    });
  });

  it("returns null when the email is missing", async () => {
    const prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaCustomerRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findByEmail("missing@example.com")).resolves.toBeNull();
  });

  it("creates a customer when id is omitted and updates when present", async () => {
    const prisma = {
      customer: {
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, fullName: "Ana P." }),
      },
    };
    const repository = new PrismaCustomerRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.save({
        fullName: "Ana Pérez",
        email: "ana@example.com",
        phone: "+573001112233",
      }),
    ).resolves.toMatchObject({ id: uuid });
    await expect(
      repository.save({
        id: uuid,
        fullName: "Ana P.",
        email: "ana@example.com",
        phone: "+573001112233",
      }),
    ).resolves.toMatchObject({ fullName: "Ana P." });
  });
});
