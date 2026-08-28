import type { ProductSeed } from "./product-seed-data";
import { productSeedData } from "./product-seed-data";

export type CatalogPrisma = {
  readonly product: {
    findFirst(args: { where: { name: string } }): Promise<{ id: string } | null>;
    update(args: {
      where: { id: string };
      data: {
        description: string;
        priceCents: number;
        imageUrl: string;
      };
    }): Promise<unknown>;
    create(args: { data: ProductSeed }): Promise<unknown>;
  };
};

/**
 * Inserts missing catalog rows. Existing products keep their `stock`
 * so a container restart does not undo purchases.
 */
export async function syncCatalogProducts(
  prisma: CatalogPrisma,
  products: readonly ProductSeed[] = productSeedData,
): Promise<void> {
  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: product.description,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
        },
      });
      continue;
    }
    await prisma.product.create({ data: product });
  }
}
