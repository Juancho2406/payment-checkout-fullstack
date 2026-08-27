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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
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
import {
  CreateTransactionRequestDto,
  ErrorResponseDto,
  PayTransactionRequestDto,
  TransactionResponseDto,
} from "./openapi";

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly createPending: CreatePendingTransactionQuery,
    private readonly getTransaction: GetTransactionQuery,
    private readonly payTransaction: PayTransactionQuery,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a PENDING transaction and reserve stock",
    description: "Does not call the PSP. Totals are recomputed like /checkout/quote.",
  })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async create(@Body() body: CreateTransactionRequestDto) {
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
  @ApiOperation({
    summary: "Charge a pending transaction via the sandbox PSP",
    description:
      "Accepts PSP tokens from the browser. Idempotent if the transaction is already APPROVED or DECLINED. Never send PAN or CVC.",
  })
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiResponse({ status: 402, description: "PSP_DECLINED", type: ErrorResponseDto })
  @ApiResponse({ status: 503, description: "PSP_TIMEOUT", type: ErrorResponseDto })
  async pay(@Param("id") id: string, @Body() body: PayTransactionRequestDto) {
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
  @ApiOperation({ summary: "Transaction status for the final screen and refresh" })
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
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
