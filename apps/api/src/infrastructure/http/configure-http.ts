import type { INestApplication } from "@nestjs/common";
import { setupOpenApi } from "./openapi";
import { applySecurity } from "./security";

export const API_PREFIX = "api/v1";

export function configureHttp(app: INestApplication): void {
  applySecurity(app);
  app.setGlobalPrefix(API_PREFIX);
  setupOpenApi(app);
}
