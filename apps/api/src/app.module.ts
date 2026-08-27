import { Module } from "@nestjs/common";
import { GetHealthQuery } from "./application/health/get-health.query";
import { HealthController } from "./infrastructure/http/health.controller";

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: GetHealthQuery,
      useFactory: () => new GetHealthQuery(),
    },
  ],
})
export class AppModule {}
