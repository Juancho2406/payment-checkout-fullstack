import { PrismaProductRepository, toProduct } from "./prisma-product.repository";
import { PrismaService } from "./prisma.service";

describe("toProduct", () => {
  it("maps a Prisma row to the domain product without persistence fields", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");

    expect(
      toProduct({
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        name: "Auriculares inalámbricos",
        description: "Over-ear, 30 h de batería",
        priceCents: 19900000,
        stock: 7,
        imageUrl: "https://example.com/headphones.jpg",
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      name: "Auriculares inalámbricos",
      description: "Over-ear, 30 h de batería",
      priceCents: 19900000,
      stock: 7,
      imageUrl: "https://example.com/headphones.jpg",
    });
  });
});

describe("PrismaProductRepository", () => {
  it("returns null for an invalid uuid without querying", async () => {
    const prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repository.findById("not-a-uuid")).resolves.toBeNull();
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it("returns false for reserveStock with an invalid uuid without querying", async () => {
    const prisma = {
      product: {
        updateMany: jest.fn(),
      },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repository.reserveStock("not-a-uuid", 1)).resolves.toBe(false);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it("returns false for releaseStock with an invalid uuid without querying", async () => {
    const prisma = {
      product: {
        updateMany: jest.fn(),
      },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repository.releaseStock("not-a-uuid", 1)).resolves.toBe(false);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  const uuid = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const row = {
    id: uuid,
    name: "Auriculares inalámbricos",
    description: "Over-ear",
    priceCents: 19900000,
    stock: 7,
    imageUrl: "https://example.com/headphones.jpg",
    createdAt: new Date("2026-08-27T12:00:00.000Z"),
    updatedAt: new Date("2026-08-27T12:00:00.000Z"),
  };

  it("lists products ordered by name", async () => {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([row]) },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findAll()).resolves.toEqual([
      {
        id: uuid,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        stock: 7,
        imageUrl: row.imageUrl,
      },
    ]);
  });

  it("returns the product when the uuid exists", async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue(row) },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(uuid)).resolves.toMatchObject({ id: uuid });
  });

  it("returns null when the uuid is missing", async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(uuid)).resolves.toBeNull();
  });

  it("reserves and releases stock when updateMany matches one row", async () => {
    const prisma = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.reserveStock(uuid, 1)).resolves.toBe(true);
    await expect(repository.releaseStock(uuid, 1)).resolves.toBe(true);
  });

  it("returns false for reserveStock when quantity is below 1", async () => {
    const prisma = {
      product: { updateMany: jest.fn() },
    };
    const repository = new PrismaProductRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.reserveStock(uuid, 0)).resolves.toBe(false);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });
});
