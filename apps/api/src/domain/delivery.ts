export const DELIVERY_STATUS_DRAFT = "draft" as const;
export const DELIVERY_STATUS_ASSIGNED = "assigned" as const;

export type DeliveryStatus =
  | typeof DELIVERY_STATUS_DRAFT
  | typeof DELIVERY_STATUS_ASSIGNED;

export type Delivery = {
  readonly id: string;
  readonly customerId: string;
  readonly address: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly status: DeliveryStatus;
};

export type DeliveryNotFoundError = {
  readonly code: "NOT_FOUND";
  readonly message: string;
};

export type DeliveryValidationError = {
  readonly code: "VALIDATION_ERROR";
  readonly message: string;
};

export function deliveryNotFound(id: string): DeliveryNotFoundError {
  return {
    code: "NOT_FOUND",
    message: `Delivery ${id} was not found`,
  };
}

export function deliveryValidationError(message: string): DeliveryValidationError {
  return { code: "VALIDATION_ERROR", message };
}

export function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export const DELIVERY_REPOSITORY = Symbol("DeliveryRepository");

export interface DeliveryRepository {
  findById(id: string): Promise<Delivery | null>;
  save(delivery: {
    readonly customerId: string;
    readonly address: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly status: DeliveryStatus;
  }): Promise<Delivery>;
}
