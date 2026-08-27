import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  QuoteCheckoutQuery,
  type QuoteCheckoutError,
} from "../../application/checkout/quote-checkout.query";

@Controller("checkout")
export class CheckoutController {
  constructor(private readonly quoteCheckout: QuoteCheckoutQuery) {}

  @Post("quote")
  @HttpCode(HttpStatus.OK)
  async quote(@Body() body: { productId?: unknown; quantity?: unknown }) {
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
