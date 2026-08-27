import type { INestApplication } from "@nestjs/common";

export const API_PREFIX = "api/v1";

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });
}
