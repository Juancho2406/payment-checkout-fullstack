import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { GetHealthQuery } from "../../application/health/get-health.query";

@Controller("health")
export class HealthController {
  constructor(private readonly getHealth: GetHealthQuery) {}

  @Get()
  getHealthStatus() {
    const result = this.getHealth.execute();
    if (result.ok) {
      return result.value;
    }
    throw new ServiceUnavailableException();
  }
}
