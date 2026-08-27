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
});
