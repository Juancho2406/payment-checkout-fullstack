import type { Product, ProductRepository } from "../../domain/product";
import { GetProductQuery } from "./get-product.query";

const keyboard: Product = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Teclado mecánico",
  description: "Switch táctil, layout español",
  priceCents: 24990000,
  stock: 4,
  imageUrl: "https://example.com/keyboard.jpg",
};

class FakeProductRepository implements ProductRepository {
  constructor(private readonly catalog: readonly Product[]) {}

  async findAll(): Promise<readonly Product[]> {
    return this.catalog;
  }

  async findById(id: string): Promise<Product | null> {
    return this.catalog.find((product) => product.id === id) ?? null;
  }

  async reserveStock(): Promise<boolean> {
    return true;
  }
}

describe("GetProductQuery", () => {
  it("returns the product when the port finds it", async () => {
    const query = new GetProductQuery(new FakeProductRepository([keyboard]));

    const result = await query.execute(keyboard.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(keyboard);
    }
  });

  it("returns NOT_FOUND when the product is missing", async () => {
    const query = new GetProductQuery(new FakeProductRepository([keyboard]));
    const missingId = "00000000-0000-4000-8000-000000000000";

    const result = await query.execute(missingId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "NOT_FOUND",
        message: `Product ${missingId} was not found`,
      });
    }
  });
});
