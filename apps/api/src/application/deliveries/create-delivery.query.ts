import {
  customerNotFound,
  type CustomerNotFoundError,
  type CustomerRepository,
} from "../../domain/customer";
import {
  DELIVERY_STATUS_DRAFT,
  deliveryValidationError,
  isNonEmptyText,
  type Delivery,
  type DeliveryRepository,
  type DeliveryValidationError,
} from "../../domain/delivery";
import { err, ok, type Result } from "../../domain/result";

export type CreateDeliveryInput = {
  readonly customerId: unknown;
  readonly address: unknown;
  readonly city: unknown;
  readonly region: unknown;
  readonly postalCode: unknown;
};

export type CreateDeliveryError = DeliveryValidationError | CustomerNotFoundError;

export class CreateDeliveryQuery {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly deliveries: DeliveryRepository,
  ) {}

  async execute(
    input: CreateDeliveryInput,
  ): Promise<Result<Delivery, CreateDeliveryError>> {
    if (typeof input.customerId !== "string" || input.customerId.length === 0) {
      return err(customerNotFound(String(input.customerId ?? "")));
    }
    if (!isNonEmptyText(input.address)) {
      return err(deliveryValidationError("address is required"));
    }
    if (!isNonEmptyText(input.city)) {
      return err(deliveryValidationError("city is required"));
    }
    if (!isNonEmptyText(input.region)) {
      return err(deliveryValidationError("region is required"));
    }
    if (!isNonEmptyText(input.postalCode)) {
      return err(deliveryValidationError("postalCode is required"));
    }

    const customer = await this.customers.findById(input.customerId);
    if (!customer) {
      return err(customerNotFound(input.customerId));
    }

    const delivery = await this.deliveries.save({
      customerId: customer.id,
      address: input.address.trim(),
      city: input.city.trim(),
      region: input.region.trim(),
      postalCode: input.postalCode.trim(),
      status: DELIVERY_STATUS_DRAFT,
    });
    return ok(delivery);
  }
}
