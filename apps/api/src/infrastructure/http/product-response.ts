import { PRODUCT_CURRENCY, type Product } from "../../domain/product";

export type ProductResponse = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly currency: typeof PRODUCT_CURRENCY;
  readonly stock: number;
  readonly imageUrl: string;
};

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    currency: PRODUCT_CURRENCY,
    stock: product.stock,
    imageUrl: product.imageUrl,
  };
}
