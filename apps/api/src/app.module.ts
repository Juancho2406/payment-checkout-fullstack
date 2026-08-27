import { Module } from "@nestjs/common";
import { QuoteCheckoutQuery } from "./application/checkout/quote-checkout.query";
import {
  GetCustomerQuery,
  UpsertCustomerQuery,
} from "./application/customers/upsert-customer.query";
import { CreateDeliveryQuery } from "./application/deliveries/create-delivery.query";
import { GetDeliveryQuery } from "./application/deliveries/get-delivery.query";
import { GetHealthQuery } from "./application/health/get-health.query";
import { GetProductQuery } from "./application/products/get-product.query";
import { ListProductsQuery } from "./application/products/list-products.query";
import { CreatePendingTransactionQuery } from "./application/transactions/create-pending-transaction.query";
import { GetTransactionQuery } from "./application/transactions/get-transaction.query";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "./domain/customer";
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from "./domain/delivery";
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from "./domain/product";
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from "./domain/transaction";
import { CheckoutController } from "./infrastructure/http/checkout.controller";
import { CustomersController } from "./infrastructure/http/customers.controller";
import { DeliveriesController } from "./infrastructure/http/deliveries.controller";
import { HealthController } from "./infrastructure/http/health.controller";
import { ProductsController } from "./infrastructure/http/products.controller";
import { TransactionsController } from "./infrastructure/http/transactions.controller";
import { PrismaModule } from "./infrastructure/persistence/prisma.module";
import { PrismaCustomerRepository } from "./infrastructure/persistence/prisma-customer.repository";
import { PrismaDeliveryRepository } from "./infrastructure/persistence/prisma-delivery.repository";
import { PrismaProductRepository } from "./infrastructure/persistence/prisma-product.repository";
import { PrismaTransactionRepository } from "./infrastructure/persistence/prisma-transaction.repository";

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthController,
    ProductsController,
    CheckoutController,
    CustomersController,
    DeliveriesController,
    TransactionsController,
  ],
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
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
    {
      provide: DELIVERY_REPOSITORY,
      useClass: PrismaDeliveryRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: PrismaTransactionRepository,
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
    {
      provide: QuoteCheckoutQuery,
      useFactory: (products: ProductRepository) => new QuoteCheckoutQuery(products),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: UpsertCustomerQuery,
      useClass: UpsertCustomerQuery,
    },
    {
      provide: GetCustomerQuery,
      useClass: GetCustomerQuery,
    },
    {
      provide: CreateDeliveryQuery,
      useFactory: (
        customers: CustomerRepository,
        deliveries: DeliveryRepository,
      ) => new CreateDeliveryQuery(customers, deliveries),
      inject: [CUSTOMER_REPOSITORY, DELIVERY_REPOSITORY],
    },
    {
      provide: GetDeliveryQuery,
      useFactory: (deliveries: DeliveryRepository) =>
        new GetDeliveryQuery(deliveries),
      inject: [DELIVERY_REPOSITORY],
    },
    {
      provide: CreatePendingTransactionQuery,
      useFactory: (
        products: ProductRepository,
        customers: CustomerRepository,
        deliveries: DeliveryRepository,
        transactions: TransactionRepository,
      ) =>
        new CreatePendingTransactionQuery(
          products,
          customers,
          deliveries,
          transactions,
        ),
      inject: [
        PRODUCT_REPOSITORY,
        CUSTOMER_REPOSITORY,
        DELIVERY_REPOSITORY,
        TRANSACTION_REPOSITORY,
      ],
    },
    {
      provide: GetTransactionQuery,
      useFactory: (transactions: TransactionRepository) =>
        new GetTransactionQuery(transactions),
      inject: [TRANSACTION_REPOSITORY],
    },
  ],
})
export class AppModule {}
