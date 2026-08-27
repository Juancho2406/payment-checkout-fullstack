import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  QuoteCheckoutQuery,
  type QuoteCheckoutError,
} from "../../application/checkout/quote-checkout.query";
import {
  ErrorResponseDto,
  QuoteRequestDto,
  QuoteResponseDto,
} from "./openapi";

@ApiTags("checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly quoteCheckout: QuoteCheckoutQuery) {}

  @Post("quote")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Recalculate checkout totals",
    description: "Fees are owned by the server. The client cannot set the total.",
  })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: "STOCK_UNAVAILABLE" })
  async quote(@Body() body: QuoteRequestDto) {
    const result = await this.quoteCheckout.execute({
      productId: body?.productId,
      quantity: body?.quantity,
    });
    if (!result.ok) {
      throwQuoteHttpError(result.error);
    }
    return result.value;
  }
}

function throwQuoteHttpError(error: QuoteCheckoutError): never {
  const status =
    error.code === "NOT_FOUND"
      ? HttpStatus.NOT_FOUND
      : error.code === "STOCK_UNAVAILABLE"
        ? HttpStatus.CONFLICT
        : HttpStatus.BAD_REQUEST;
  throw new HttpException({ error: { code: error.code, message: error.message } }, status);
}
