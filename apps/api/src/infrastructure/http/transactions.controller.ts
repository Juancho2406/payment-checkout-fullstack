import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  CreatePendingTransactionQuery,
  type CreatePendingTransactionError,
} from "../../application/transactions/create-pending-transaction.query";
import { GetTransactionQuery } from "../../application/transactions/get-transaction.query";
import {
  PayTransactionQuery,
  type PayTransactionError,
} from "../../application/transactions/pay-transaction.query";
import type { TransactionNotFoundError } from "../../domain/transaction";

@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly createPending: CreatePendingTransactionQuery,
    private readonly getTransaction: GetTransactionQuery,
    private readonly payTransaction: PayTransactionQuery,
  ) {}

  @Post()
  async create(
    @Body()
    body: {
      productId?: unknown;
      quantity?: unknown;
      customerId?: unknown;
      deliveryId?: unknown;
      reference?: unknown;
    },
  ) {
    const result = await this.createPending.execute({
      productId: body?.productId,
      quantity: body?.quantity,
      customerId: body?.customerId,
      deliveryId: body?.deliveryId,
      reference: body?.reference,
    });
    if (!result.ok) {
      throwTransactionHttpError(result.error);
    }
    return result.value;
  }

  @Post(":id/pay")
  @HttpCode(HttpStatus.OK)
  async pay(
    @Param("id") id: string,
    @Body()
    body: {
      paymentToken?: unknown;
      acceptanceToken?: unknown;
      acceptPersonalAuth?: unknown;
      installments?: unknown;
    },
  ) {
    const result = await this.payTransaction.execute({
      transactionId: id,
      paymentToken: body?.paymentToken,
      acceptanceToken: body?.acceptanceToken,
      acceptPersonalAuth: body?.acceptPersonalAuth,
      installments: body?.installments,
    });
    if (!result.ok) {
      throwTransactionHttpError(result.error);
    }
    return result.value;
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const result = await this.getTransaction.execute(id);
    if (!result.ok) {
      throwTransactionHttpError(result.error);
    }
    return result.value;
  }
}

function throwTransactionHttpError(
  error: CreatePendingTransactionError | PayTransactionError | TransactionNotFoundError,
): never {
  const status =
    error.code === "NOT_FOUND"
      ? HttpStatus.NOT_FOUND
      : error.code === "STOCK_UNAVAILABLE" || error.code === "CONFLICT"
        ? HttpStatus.CONFLICT
        : error.code === "PSP_DECLINED"
          ? HttpStatus.PAYMENT_REQUIRED
          : error.code === "PSP_TIMEOUT"
            ? HttpStatus.SERVICE_UNAVAILABLE
            : HttpStatus.BAD_REQUEST;
  throw new HttpException(
    { error: { code: error.code, message: error.message } },
    status,
  );
}
