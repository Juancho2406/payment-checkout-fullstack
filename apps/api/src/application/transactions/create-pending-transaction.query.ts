import {
  computeQuote,
  invalidQuantity,
  isPositiveInt,
  stockUnavailable,
  type InvalidQuantityError,
  type StockUnavailableError,
} from "../../domain/checkout";
import {
  customerNotFound,
  type CustomerNotFoundError,
  type CustomerRepository,
} from "../../domain/customer";
import {
  deliveryNotFound,
  type DeliveryNotFoundError,
  type DeliveryRepository,
} from "../../domain/delivery";
import {
  productNotFound,
  type ProductNotFoundError,
  type ProductRepository,
} from "../../domain/product";
import { err, ok, type Result } from "../../domain/result";
import {
  deliveryConflict,
  deliveryMismatch,
  generateReference,
  invalidReference,
  isValidReference,
  referenceConflict,
  type CheckoutTransaction,
  type ConflictError,
  type TransactionRepository,
  type TransactionValidationError,
} from "../../domain/transaction";

export type CreatePendingTransactionInput = {
  readonly productId: unknown;
  readonly quantity: unknown;
  readonly customerId: unknown;
  readonly deliveryId: unknown;
  readonly reference?: unknown;
};

export type CreatePendingTransactionError =
  | InvalidQuantityError
  | ProductNotFoundError
  | CustomerNotFoundError
  | DeliveryNotFoundError
  | TransactionValidationError
  | StockUnavailableError
  | ConflictError;

export class CreatePendingTransactionQuery {
  constructor(
    private readonly products: ProductRepository,
    private readonly customers: CustomerRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    input: CreatePendingTransactionInput,
  ): Promise<Result<CheckoutTransaction, CreatePendingTransactionError>> {
    if (typeof input.productId !== "string" || input.productId.length === 0) {
      return err(productNotFound(String(input.productId ?? "")));
    }
    if (typeof input.customerId !== "string" || input.customerId.length === 0) {
      return err(customerNotFound(String(input.customerId ?? "")));
    }
    if (typeof input.deliveryId !== "string" || input.deliveryId.length === 0) {
      return err(deliveryNotFound(String(input.deliveryId ?? "")));
    }
    if (!isPositiveInt(input.quantity)) {
      return err(invalidQuantity(input.quantity));
    }

    const referenceResult = resolveReference(input.reference);
    if (!referenceResult.ok) {
      return referenceResult;
    }
    const reference = referenceResult.value;

    const existingRef = await this.transactions.findByReference(reference);
    if (existingRef) {
      return err(referenceConflict(reference));
    }

    const product = await this.products.findById(input.productId);
    if (!product) {
      return err(productNotFound(input.productId));
    }
    const customer = await this.customers.findById(input.customerId);
    if (!customer) {
      return err(customerNotFound(input.customerId));
    }
    const delivery = await this.deliveries.findById(input.deliveryId);
    if (!delivery) {
      return err(deliveryNotFound(input.deliveryId));
    }
    if (delivery.customerId !== customer.id) {
      return err(deliveryMismatch());
    }
    if (input.quantity > product.stock) {
      return err(stockUnavailable(input.quantity, product.stock));
    }

    const quote = computeQuote(product, input.quantity);
    const outcome = await this.transactions.createPending({
      reference,
      productId: product.id,
      customerId: customer.id,
      deliveryId: delivery.id,
      quantity: input.quantity,
      productAmountCents: quote.productAmountCents,
      baseFeeCents: quote.baseFeeCents,
      deliveryFeeCents: quote.deliveryFeeCents,
      totalCents: quote.totalCents,
      currency: quote.currency,
    });
    if (outcome.kind === "stock") {
      return err(stockUnavailable(input.quantity, product.stock));
    }
    if (outcome.kind === "reference") {
      return err(referenceConflict(reference));
    }
    if (outcome.kind === "delivery") {
      return err(deliveryConflict(delivery.id));
    }
    return ok(outcome.transaction);
  }
}

function resolveReference(
  value: unknown,
): Result<string, TransactionValidationError> {
  if (value === undefined || value === null) {
    return ok(generateReference());
  }
  if (typeof value !== "string") {
    return err(invalidReference(value));
  }
  if (value.trim() === "") {
    return ok(generateReference());
  }
  if (!isValidReference(value)) {
    return err(invalidReference(value));
  }
  return ok(value.trim());
}
