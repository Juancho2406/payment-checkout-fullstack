import {
  BASE_FEE_CENTS,
  DELIVERY_FEE_CENTS,
} from "../../domain/checkout";
import type { Product, ProductRepository } from "../../domain/product";
import { QuoteCheckoutQuery } from "./quote-checkout.query";

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
}

describe("QuoteCheckoutQuery", () => {
  const query = new QuoteCheckoutQuery(new FakeProductRepository([headphones]));

  it("recalculates product amount plus fixed base and delivery fees", async () => {
    const result = await query.execute({
      productId: headphones.id,
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        productId: headphones.id,
        quantity: 1,
        productAmountCents: 19900000,
        baseFeeCents: BASE_FEE_CENTS,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: 21200000,
        currency: "COP",
        stock: 7,
      });
    }
  });

  it("multiplies product amount by quantity and keeps fees per checkout", async () => {
    const result = await query.execute({
      productId: headphones.id,
      quantity: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.productAmountCents).toBe(39800000);
      expect(result.value.baseFeeCents).toBe(BASE_FEE_CENTS);
      expect(result.value.deliveryFeeCents).toBe(DELIVERY_FEE_CENTS);
      expect(result.value.totalCents).toBe(39800000 + BASE_FEE_CENTS + DELIVERY_FEE_CENTS);
    }
  });

  it("returns NOT_FOUND when the product is missing", async () => {
    const missingId = "00000000-0000-4000-8000-000000000000";
    const result = await query.execute({ productId: missingId, quantity: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns INVALID_QUANTITY when quantity is not a positive integer", async () => {
    const result = await query.execute({
      productId: headphones.id,
      quantity: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_QUANTITY");
    }
  });

  it("returns STOCK_UNAVAILABLE when quantity exceeds stock", async () => {
    const result = await query.execute({
      productId: headphones.id,
      quantity: 8,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "STOCK_UNAVAILABLE",
        message: "Requested 8 but only 7 in stock",
      });
    }
  });
});
