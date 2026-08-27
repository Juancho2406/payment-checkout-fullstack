export type HealthStatus = {
  readonly status: "ok";
};

export function healthy(): HealthStatus {
  return { status: "ok" };
}
