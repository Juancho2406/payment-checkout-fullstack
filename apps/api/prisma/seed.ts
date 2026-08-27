import { PrismaClient } from "@prisma/client";
import { productSeedData } from "../src/infrastructure/persistence/product-seed-data";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.product.count();
  if (existing > 0) {
    return;
  }

  await prisma.product.createMany({
    data: [...productSeedData],
  });
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
