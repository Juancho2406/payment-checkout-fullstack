import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("exposes the four kata models without connecting", () => {
    const prisma = new PrismaService();

    expect(prisma.product).toBeDefined();
    expect(prisma.customer).toBeDefined();
    expect(prisma.transaction).toBeDefined();
    expect(prisma.delivery).toBeDefined();
  });

  it("disconnects on module destroy", async () => {
    const prisma = new PrismaService();
    prisma.$disconnect = jest.fn().mockResolvedValue(undefined);
    await prisma.onModuleDestroy();
    expect(prisma.$disconnect).toHaveBeenCalled();
  });

  it("falls back to the local database url", () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const prisma = new PrismaService();
    expect(prisma.product).toBeDefined();
    process.env.DATABASE_URL = previous;
  });
});
