import {
  computeQuote,
  invalidQuantity,
  isPositiveInt,
  stockUnavailable,
  type CheckoutQuote,
  type InvalidQuantityError,
  type StockUnavailableError,
} from "../../domain/checkout";
import {
  productNotFound,
  type ProductNotFoundError,
  type ProductRepository,
} from "../../domain/product";
import { err, ok, type Result } from "../../domain/result";

export type QuoteCheckoutInput = {
  readonly productId: unknown;
  readonly quantity: unknown;
};

export type QuoteCheckoutError =
  | InvalidQuantityError
  | ProductNotFoundError
  | StockUnavailableError;

export class QuoteCheckoutQuery {
  constructor(private readonly products: ProductRepository) {}

  async execute(
    input: QuoteCheckoutInput,
  ): Promise<Result<CheckoutQuote, QuoteCheckoutError>> {
    if (typeof input.productId !== "string" || input.productId.length === 0) {
      return err(productNotFound(String(input.productId ?? "")));
    }
    if (!isPositiveInt(input.quantity)) {
      return err(invalidQuantity(input.quantity));
    }

    const product = await this.products.findById(input.productId);
    if (!product) {
      return err(productNotFound(input.productId));
    }
    if (input.quantity > product.stock) {
      return err(stockUnavailable(input.quantity, product.stock));
    }

    return ok(computeQuote(product, input.quantity));
  }
}
