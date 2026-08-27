import type { Product, ProductRepository } from "../../domain/product";
import { ListProductsQuery } from "./list-products.query";

const headphones: Product = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  name: "Auriculares inalámbricos",
  description: "Over-ear, 30 h de batería",
  priceCents: 19900000,
  stock: 7,
  imageUrl: "https://example.com/headphones.jpg",
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

describe("ListProductsQuery", () => {
  it("returns the catalog from the product port", async () => {
    const query = new ListProductsQuery(new FakeProductRepository([headphones]));

    const result = await query.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([headphones]);
    }
  });

  it("returns an empty list when the catalog is empty", async () => {
    const query = new ListProductsQuery(new FakeProductRepository([]));

    const result = await query.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});
