import { PrismaClient } from "@prisma/client";
import { productSeedData } from "../src/infrastructure/persistence/product-seed-data";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const product of productSeedData) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: product.description,
          priceCents: product.priceCents,
          stock: product.stock,
          imageUrl: product.imageUrl,
        },
      });
      continue;
    }
    await prisma.product.create({ data: product });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
