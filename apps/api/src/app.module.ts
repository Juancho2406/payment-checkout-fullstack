import { Module } from "@nestjs/common";
import { GetHealthQuery } from "./application/health/get-health.query";
import { HealthController } from "./infrastructure/http/health.controller";
import { PrismaModule } from "./infrastructure/persistence/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    {
      provide: GetHealthQuery,
      useFactory: () => new GetHealthQuery(),
    },
  ],
})
export class AppModule {}
