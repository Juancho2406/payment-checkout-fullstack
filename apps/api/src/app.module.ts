import { Module } from "@nestjs/common";
import { GetHealthQuery } from "./application/health/get-health.query";
import { GetProductQuery } from "./application/products/get-product.query";
import { ListProductsQuery } from "./application/products/list-products.query";
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from "./domain/product";
import { HealthController } from "./infrastructure/http/health.controller";
import { ProductsController } from "./infrastructure/http/products.controller";
import { PrismaModule } from "./infrastructure/persistence/prisma.module";
import { PrismaProductRepository } from "./infrastructure/persistence/prisma-product.repository";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, ProductsController],
  providers: [
    {
      provide: GetHealthQuery,
      useFactory: () => new GetHealthQuery(),
    },
    {
      provide: PRODUCT_REPOSITORY,
      useClass: PrismaProductRepository,
    },
    {
      provide: ListProductsQuery,
      useFactory: (products: ProductRepository) => new ListProductsQuery(products),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: GetProductQuery,
      useFactory: (products: ProductRepository) => new GetProductQuery(products),
      inject: [PRODUCT_REPOSITORY],
    },
  ],
})
export class AppModule {}
