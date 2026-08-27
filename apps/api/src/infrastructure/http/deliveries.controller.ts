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
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CreateDeliveryQuery } from "../../application/deliveries/create-delivery.query";
import { GetDeliveryQuery } from "../../application/deliveries/get-delivery.query";
import type { CustomerNotFoundError } from "../../domain/customer";
import type {
  DeliveryNotFoundError,
  DeliveryValidationError,
} from "../../domain/delivery";
import {
  DeliveryRequestDto,
  DeliveryResponseDto,
  ErrorResponseDto,
} from "./openapi";

@ApiTags("deliveries")
@Controller("deliveries")
export class DeliveriesController {
  constructor(
    private readonly createDelivery: CreateDeliveryQuery,
    private readonly getDelivery: GetDeliveryQuery,
  ) {}

  @Post()
  @ApiOperation({ summary: "Save a draft delivery address before pay" })
  @ApiCreatedResponse({ type: DeliveryResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async create(@Body() body: DeliveryRequestDto) {
    const result = await this.createDelivery.execute({
      customerId: body?.customerId,
      address: body?.address,
      city: body?.city,
      region: body?.region,
      postalCode: body?.postalCode,
    });
    if (!result.ok) {
      throwDeliveryHttpError(result.error);
    }
    return result.value;
  }

  @Get(":id")
  @ApiOperation({ summary: "Load a delivery address" })
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: DeliveryResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async getById(@Param("id") id: string) {
    const result = await this.getDelivery.execute(id);
    if (!result.ok) {
      throwDeliveryHttpError(result.error);
    }
    return result.value;
  }
}

function throwDeliveryHttpError(
  error:
    | DeliveryNotFoundError
    | DeliveryValidationError
    | CustomerNotFoundError,
): never {
  const status =
    error.code === "NOT_FOUND"
      ? HttpStatus.NOT_FOUND
      : HttpStatus.BAD_REQUEST;
  throw new HttpException(
    { error: { code: error.code, message: error.message } },
    status,
  );
}
