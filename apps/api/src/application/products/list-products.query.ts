import type { Product, ProductRepository } from "../../domain/product";
import { ok, type Result } from "../../domain/result";

export class ListProductsQuery {
  constructor(private readonly products: ProductRepository) {}

  async execute(): Promise<Result<readonly Product[], never>> {
    const catalog = await this.products.findAll();
    return ok(catalog);
  }
}
