import {
  productNotFound,
  type Product,
  type ProductNotFoundError,
  type ProductRepository,
} from "../../domain/product";
import { err, ok, type Result } from "../../domain/result";

export class GetProductQuery {
  constructor(private readonly products: ProductRepository) {}

  async execute(
    id: string,
  ): Promise<Result<Product, ProductNotFoundError>> {
    const product = await this.products.findById(id);
    if (!product) {
      return err(productNotFound(id));
    }
    return ok(product);
  }
}
