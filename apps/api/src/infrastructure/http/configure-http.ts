import type { INestApplication } from "@nestjs/common";

export const API_PREFIX = "api/v1";

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}
