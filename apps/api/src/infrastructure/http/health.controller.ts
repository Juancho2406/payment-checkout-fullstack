import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GetHealthQuery } from "../../application/health/get-health.query";
import { HealthResponseDto } from "./openapi";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly getHealth: GetHealthQuery) {}

  @Get()
  @ApiOperation({ summary: "Liveness" })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealthStatus() {
    const result = this.getHealth.execute();
    if (result.ok) {
      return result.value;
    }
    throw new ServiceUnavailableException();
  }
}
