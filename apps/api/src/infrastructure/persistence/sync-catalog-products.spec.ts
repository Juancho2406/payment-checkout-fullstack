import { productSeedData } from "./product-seed-data";
import { syncCatalogProducts } from "./sync-catalog-products";

describe("syncCatalogProducts", () => {
  it("creates missing products with the seed stock", async () => {
    const created: unknown[] = [];
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
        }),
      },
    };

    await syncCatalogProducts(prisma, productSeedData);

    expect(prisma.product.create).toHaveBeenCalledTimes(productSeedData.length);
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(created).toEqual([...productSeedData]);
  });

  it("refreshes catalog copy without overwriting stock", async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: "existing-id" }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };

    await syncCatalogProducts(prisma, [productSeedData[0]!]);

    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: "existing-id" },
      data: {
        description: productSeedData[0]!.description,
        priceCents: productSeedData[0]!.priceCents,
        imageUrl: productSeedData[0]!.imageUrl,
      },
    });
    expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty("stock");
  });
});
