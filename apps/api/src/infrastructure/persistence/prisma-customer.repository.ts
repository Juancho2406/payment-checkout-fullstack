import { Injectable } from "@nestjs/common";
import type { Customer as CustomerRow } from "@prisma/client";
import type { Customer, CustomerRepository } from "../../domain/customer";
import { PrismaService } from "./prisma.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
  };
}

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Customer | null> {
    if (!UUID_RE.test(id)) {
      return null;
    }
    const row = await this.prisma.customer.findUnique({ where: { id } });
    return row ? toCustomer(row) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { email } });
    return row ? toCustomer(row) : null;
  }

  async save(customer: {
    readonly id?: string;
    readonly fullName: string;
    readonly email: string;
    readonly phone: string;
  }): Promise<Customer> {
    if (customer.id) {
      const row = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
        },
      });
      return toCustomer(row);
    }
    const row = await this.prisma.customer.create({
      data: {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
    });
    return toCustomer(row);
  }
}
