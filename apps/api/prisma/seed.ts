import { PrismaClient } from "@prisma/client";
import { syncCatalogProducts } from "../src/infrastructure/persistence/sync-catalog-products";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await syncCatalogProducts(prisma);
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
