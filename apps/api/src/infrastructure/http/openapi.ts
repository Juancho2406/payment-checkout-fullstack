import { ApiProperty, ApiPropertyOptional, DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export const OPENAPI_PATH = "docs";
export const OPENAPI_JSON_PATH = "docs-json";

export class ErrorBodyDto {
  @ApiProperty({ example: "NOT_FOUND" })
  code!: string;

  @ApiProperty({ example: "Product was not found" })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;
}

export class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" })
  id!: string;

  @ApiProperty({ example: "Auriculares inalámbricos" })
  name!: string;

  @ApiProperty({ example: "Over-ear, 30 h de batería" })
  description!: string;

  @ApiProperty({ example: 12_990_000, description: "COP cents" })
  priceCents!: number;

  @ApiProperty({ example: "COP", enum: ["COP"] })
  currency!: "COP";

  @ApiProperty({ example: 8 })
  stock!: number;

  @ApiProperty({ example: "/products/headphones.jpg" })
  imageUrl!: string;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data!: ProductResponseDto[];
}

export class QuoteRequestDto {
  @ApiProperty({ example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" })
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  quantity!: number;
}

export class QuoteResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 12_990_000 })
  productAmountCents!: number;

  @ApiProperty({ example: 500_000 })
  baseFeeCents!: number;

  @ApiProperty({ example: 800_000 })
  deliveryFeeCents!: number;

  @ApiProperty({ example: 14_290_000 })
  totalCents!: number;

  @ApiProperty({ example: "COP", enum: ["COP"] })
  currency!: "COP";

  @ApiProperty({ example: 8 })
  stock!: number;
}

export class CustomerRequestDto {
  @ApiProperty({ example: "Ana Pérez" })
  fullName!: string;

  @ApiProperty({ example: "ana@example.com" })
  email!: string;

  @ApiProperty({ example: "+573001112233" })
  phone!: string;
}

export class CustomerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;
}

export class DeliveryRequestDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty({ example: "Cra 7 # 12-34" })
  address!: string;

  @ApiProperty({ example: "Bogotá" })
  city!: string;

  @ApiProperty({ example: "Cundinamarca" })
  region!: string;

  @ApiProperty({ example: "110111" })
  postalCode!: string;
}

export class DeliveryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  region!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty({ enum: ["draft", "assigned"], example: "draft" })
  status!: "draft" | "assigned";
}

export class CreateTransactionRequestDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  quantity!: number;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  deliveryId!: string;

  @ApiPropertyOptional({
    description: "Optional client reference. The API generates CHK-YYYYMMDD-XXXXXX if omitted.",
  })
  reference?: string;
}

export class PayTransactionRequestDto {
  @ApiProperty({
    example: "tok_test_visa",
    description: "Card token from the PSP (browser). Never send PAN or CVC.",
  })
  paymentToken!: string;

  @ApiProperty({ example: "eyJ-acceptance" })
  acceptanceToken!: string;

  @ApiPropertyOptional({ example: "eyJ-personal" })
  acceptPersonalAuth?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  installments?: number;
}

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: "CHK-20260827-AB12CD" })
  reference!: string;

  @ApiProperty({ enum: ["PENDING", "APPROVED", "DECLINED", "ERROR"] })
  status!: "PENDING" | "APPROVED" | "DECLINED" | "ERROR";

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  deliveryId!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 12_990_000 })
  productAmountCents!: number;

  @ApiProperty({ example: 500_000 })
  baseFeeCents!: number;

  @ApiProperty({ example: 800_000 })
  deliveryFeeCents!: number;

  @ApiProperty({ example: 14_290_000 })
  totalCents!: number;

  @ApiProperty({ example: "COP", enum: ["COP"] })
  currency!: "COP";

  @ApiPropertyOptional({ nullable: true })
  pspTransactionId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "VISA" })
  cardBrand!: string | null;

  @ApiPropertyOptional({ nullable: true, example: "1111" })
  cardLast4!: string | null;
}

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Payment Checkout API")
    .setDescription(
      [
        "Checkout anónimo de un producto. Montos en centavos COP.",
        "La API **nunca** recibe PAN ni CVC: el browser tokeniza contra el PSP (llave pública) y aquí solo llega `paymentToken`.",
        "Errores: `{ \"error\": { \"code\", \"message\" } }` (`VALIDATION_ERROR`, `NOT_FOUND`, `STOCK_UNAVAILABLE`, `CONFLICT`, `PSP_DECLINED`, `PSP_TIMEOUT`).",
        "`POST /transactions/:id/pay` es idempotente si la transacción ya está `APPROVED` o `DECLINED`.",
      ].join("\n\n"),
    )
    .setVersion("1.0")
    .addServer("http://localhost:3001", "Local")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponseDto],
  });
  SwaggerModule.setup(OPENAPI_PATH, app, document, {
    customSiteTitle: "Payment Checkout API",
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
