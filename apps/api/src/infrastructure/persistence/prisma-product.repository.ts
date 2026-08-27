import { Injectable } from "@nestjs/common";
import type { Product as ProductRow } from "@prisma/client";
import type { Product, ProductRepository } from "../../domain/product";
import { PrismaService } from "./prisma.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    stock: row.stock,
    imageUrl: row.imageUrl,
  };
}

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<readonly Product[]> {
    const rows = await this.prisma.product.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map(toProduct);
  }

  async findById(id: string): Promise<Product | null> {
    if (!UUID_RE.test(id)) {
      return null;
    }

    const row = await this.prisma.product.findUnique({
      where: { id },
    });
    return row ? toProduct(row) : null;
  }

  async reserveStock(id: string, quantity: number): Promise<boolean> {
    if (!UUID_RE.test(id) || quantity < 1) {
      return false;
    }
    const result = await this.prisma.product.updateMany({
      where: { id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    return result.count === 1;
  }

  async releaseStock(id: string, quantity: number): Promise<boolean> {
    if (!UUID_RE.test(id) || quantity < 1) {
      return false;
    }
    const result = await this.prisma.product.updateMany({
      where: { id },
      data: { stock: { increment: quantity } },
    });
    return result.count === 1;
  }
}
