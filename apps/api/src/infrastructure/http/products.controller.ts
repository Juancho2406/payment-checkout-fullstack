import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { GetProductQuery } from "../../application/products/get-product.query";
import { ListProductsQuery } from "../../application/products/list-products.query";
import type { ProductNotFoundError } from "../../domain/product";
import { toProductResponse } from "./product-response";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsQuery,
    private readonly getProduct: GetProductQuery,
  ) {}

  @Get()
  async list() {
    const result = await this.listProducts.execute();
    if (result.ok) {
      return { data: result.value.map(toProductResponse) };
    }
    throw new HttpException(
      { error: { code: "UNEXPECTED", message: "Could not list products" } },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const result = await this.getProduct.execute(id);
    if (!result.ok) {
      throwDomainHttpError(result.error);
    }
    return toProductResponse(result.value);
  }
}

function throwDomainHttpError(error: ProductNotFoundError): never {
  throw new HttpException(
    { error: { code: error.code, message: error.message } },
    error.code === "NOT_FOUND" ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
  );
}
