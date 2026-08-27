import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  GetCustomerQuery,
  UpsertCustomerQuery,
} from "../../application/customers/upsert-customer.query";
import type {
  CustomerNotFoundError,
  CustomerValidationError,
} from "../../domain/customer";

@Controller("customers")
export class CustomersController {
  constructor(
    private readonly upsertCustomer: UpsertCustomerQuery,
    private readonly getCustomer: GetCustomerQuery,
  ) {}

  @Post()
  async create(
    @Body()
    body: { fullName?: unknown; email?: unknown; phone?: unknown },
  ) {
    const result = await this.upsertCustomer.execute({
      fullName: body?.fullName,
      email: body?.email,
      phone: body?.phone,
    });
    if (!result.ok) {
      throwCustomerHttpError(result.error);
    }
    return result.value;
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const result = await this.getCustomer.execute(id);
    if (!result.ok) {
      throwCustomerHttpError(result.error);
    }
    return result.value;
  }
}

function throwCustomerHttpError(
  error: CustomerNotFoundError | CustomerValidationError,
): never {
  const status =
    error.code === "NOT_FOUND" ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
  throw new HttpException(
    { error: { code: error.code, message: error.message } },
    status,
  );
}
