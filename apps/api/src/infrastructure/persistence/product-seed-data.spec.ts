import { productSeedData } from "./product-seed-data";

describe("productSeedData", () => {
  it("seeds at least two catalog products in COP cents", () => {
    expect(productSeedData.length).toBeGreaterThanOrEqual(2);

    for (const product of productSeedData) {
      expect(product.name.length).toBeGreaterThan(0);
      expect(product.description.length).toBeGreaterThan(0);
      expect(Number.isInteger(product.priceCents)).toBe(true);
      expect(product.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(product.stock)).toBe(true);
      expect(product.stock).toBeGreaterThan(0);
      expect(product.imageUrl).toMatch(/^https:\/\//);
    }
  });
});
