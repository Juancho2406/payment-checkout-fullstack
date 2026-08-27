export type Customer = {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
};

export type CustomerNotFoundError = {
  readonly code: "NOT_FOUND";
  readonly message: string;
};

export type CustomerValidationError = {
  readonly code: "VALIDATION_ERROR";
  readonly message: string;
};

export function customerNotFound(id: string): CustomerNotFoundError {
  return {
    code: "NOT_FOUND",
    message: `Customer ${id} was not found`,
  };
}

export function customerValidationError(message: string): CustomerValidationError {
  return { code: "VALIDATION_ERROR", message };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CO_PHONE_RE = /^(?:\+57)?3\d{9}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isValidColombianPhone(phone: string): boolean {
  return CO_PHONE_RE.test(phone.replace(/[\s-]/g, ""));
}

export function isValidFullName(name: string): boolean {
  return name.trim().length >= 2;
}

export const CUSTOMER_REPOSITORY = Symbol("CustomerRepository");

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  save(customer: {
    readonly id?: string;
    readonly fullName: string;
    readonly email: string;
    readonly phone: string;
  }): Promise<Customer>;
}
