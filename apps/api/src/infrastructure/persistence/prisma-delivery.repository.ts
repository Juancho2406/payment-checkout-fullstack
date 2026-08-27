import { Injectable } from "@nestjs/common";
import type { Delivery as DeliveryRow } from "@prisma/client";
import {
  DELIVERY_STATUS_ASSIGNED,
  DELIVERY_STATUS_DRAFT,
  type Delivery,
  type DeliveryRepository,
  type DeliveryStatus,
} from "../../domain/delivery";
import { PrismaService } from "./prisma.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toStatus(value: string): DeliveryStatus {
  return value === DELIVERY_STATUS_ASSIGNED
    ? DELIVERY_STATUS_ASSIGNED
    : DELIVERY_STATUS_DRAFT;
}

export function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    customerId: row.customerId,
    address: row.address,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    status: toStatus(row.status),
  };
}

@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Delivery | null> {
    if (!UUID_RE.test(id)) {
      return null;
    }
    const row = await this.prisma.delivery.findUnique({ where: { id } });
    return row ? toDelivery(row) : null;
  }

  async save(delivery: {
    readonly customerId: string;
    readonly address: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly status: DeliveryStatus;
  }): Promise<Delivery> {
    const row = await this.prisma.delivery.create({
      data: {
        customerId: delivery.customerId,
        address: delivery.address,
        city: delivery.city,
        region: delivery.region,
        postalCode: delivery.postalCode,
        status: delivery.status,
      },
    });
    return toDelivery(row);
  }
}
