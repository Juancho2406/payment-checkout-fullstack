import { DELIVERY_STATUS_ASSIGNED, DELIVERY_STATUS_DRAFT } from "../../domain/delivery";
import {
  PrismaDeliveryRepository,
  toDelivery,
} from "./prisma-delivery.repository";
import { PrismaService } from "./prisma.service";

const now = new Date("2026-08-27T12:00:00.000Z");
const uuid = "22222222-2222-4222-8222-222222222222";
const row = {
  id: uuid,
  customerId: "11111111-1111-4111-8111-111111111111",
  address: "Cra 7 # 12-34",
  city: "Bogotá",
  region: "Cundinamarca",
  postalCode: "110111",
  status: "draft",
  transactionId: null,
  createdAt: now,
  updatedAt: now,
};

describe("toDelivery", () => {
  it("maps draft and assigned statuses", () => {
    expect(toDelivery(row).status).toBe(DELIVERY_STATUS_DRAFT);
    expect(toDelivery({ ...row, status: "assigned" }).status).toBe(
      DELIVERY_STATUS_ASSIGNED,
    );
  });
});

describe("PrismaDeliveryRepository", () => {
  it("returns null for an invalid uuid without querying", async () => {
    const prisma = { delivery: { findUnique: jest.fn() } };
    const repository = new PrismaDeliveryRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById("not-a-uuid")).resolves.toBeNull();
    expect(prisma.delivery.findUnique).not.toHaveBeenCalled();
  });

  it("returns the delivery when the uuid exists", async () => {
    const prisma = {
      delivery: { findUnique: jest.fn().mockResolvedValue(row) },
    };
    const repository = new PrismaDeliveryRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(uuid)).resolves.toMatchObject({
      id: uuid,
      city: "Bogotá",
    });
  });

  it("returns null when the uuid is missing", async () => {
    const prisma = {
      delivery: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaDeliveryRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repository.findById(uuid)).resolves.toBeNull();
  });

  it("persists a draft delivery", async () => {
    const prisma = {
      delivery: { create: jest.fn().mockResolvedValue(row) },
    };
    const repository = new PrismaDeliveryRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.save({
        customerId: row.customerId,
        address: row.address,
        city: row.city,
        region: row.region,
        postalCode: row.postalCode,
        status: DELIVERY_STATUS_DRAFT,
      }),
    ).resolves.toMatchObject({ id: uuid, status: DELIVERY_STATUS_DRAFT });
  });
});
