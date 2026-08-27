import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_REPOSITORY,
  customerNotFound,
  customerValidationError,
  isValidColombianPhone,
  isValidEmail,
  isValidFullName,
  normalizeEmail,
  type Customer,
  type CustomerNotFoundError,
  type CustomerRepository,
  type CustomerValidationError,
} from "../../domain/customer";
import { err, ok, type Result } from "../../domain/result";

export type UpsertCustomerInput = {
  readonly fullName: unknown;
  readonly email: unknown;
  readonly phone: unknown;
};

export type UpsertCustomerError = CustomerValidationError;

@Injectable()
export class UpsertCustomerQuery {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
  ) {}

  async execute(
    input: UpsertCustomerInput,
  ): Promise<Result<Customer, UpsertCustomerError>> {
    if (typeof input.fullName !== "string" || !isValidFullName(input.fullName)) {
      return err(customerValidationError("fullName must be at least 2 characters"));
    }
    if (typeof input.email !== "string" || !isValidEmail(input.email.trim())) {
      return err(customerValidationError("email is invalid"));
    }
    if (typeof input.phone !== "string" || !isValidColombianPhone(input.phone)) {
      return err(customerValidationError("phone must be a Colombian mobile number"));
    }

    const email = normalizeEmail(input.email);
    const existing = await this.customers.findByEmail(email);
    const saved = await this.customers.save({
      ...(existing ? { id: existing.id } : {}),
      fullName: input.fullName.trim(),
      email,
      phone: input.phone.replace(/[\s-]/g, ""),
    });
    return ok(saved);
  }
}

@Injectable()
export class GetCustomerQuery {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
  ) {}

  async execute(
    id: string,
  ): Promise<Result<Customer, CustomerNotFoundError>> {
    const customer = await this.customers.findById(id);
    if (!customer) {
      return err(customerNotFound(id));
    }
    return ok(customer);
  }
}
