export const PRODUCT_CURRENCY = "COP" as const;

export type Product = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly stock: number;
  readonly imageUrl: string;
};

export type ProductNotFoundError = {
  readonly code: "NOT_FOUND";
  readonly message: string;
};

export function productNotFound(id: string): ProductNotFoundError {
  return {
    code: "NOT_FOUND",
    message: `Product ${id} was not found`,
  };
}

export const PRODUCT_REPOSITORY = Symbol("ProductRepository");

export interface ProductRepository {
  findAll(): Promise<readonly Product[]>;
  findById(id: string): Promise<Product | null>;
  /** Atomic decrement. `false` if the row is missing or stock is insufficient. */
  reserveStock(id: string, quantity: number): Promise<boolean>;
}
