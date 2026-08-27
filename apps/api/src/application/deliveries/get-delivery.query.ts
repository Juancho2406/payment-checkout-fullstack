import {
  deliveryNotFound,
  type Delivery,
  type DeliveryNotFoundError,
  type DeliveryRepository,
} from "../../domain/delivery";
import { err, ok, type Result } from "../../domain/result";

export class GetDeliveryQuery {
  constructor(private readonly deliveries: DeliveryRepository) {}

  async execute(
    id: string,
  ): Promise<Result<Delivery, DeliveryNotFoundError>> {
    const delivery = await this.deliveries.findById(id);
    if (!delivery) {
      return err(deliveryNotFound(id));
    }
    return ok(delivery);
  }
}
