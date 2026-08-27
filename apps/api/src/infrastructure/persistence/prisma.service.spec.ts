import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("exposes the four kata models without connecting", () => {
    const prisma = new PrismaService();

    expect(prisma.product).toBeDefined();
    expect(prisma.customer).toBeDefined();
    expect(prisma.transaction).toBeDefined();
    expect(prisma.delivery).toBeDefined();
  });
});
