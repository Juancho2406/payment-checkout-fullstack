import { healthy, type HealthStatus } from "../../domain/health";
import { ok, type Result } from "../../domain/result";

export class GetHealthQuery {
  execute(): Result<HealthStatus, never> {
    return ok(healthy());
  }
}
