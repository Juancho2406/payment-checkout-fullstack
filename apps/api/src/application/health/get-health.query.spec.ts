import { GetHealthQuery } from "./get-health.query";

describe("GetHealthQuery", () => {
  it("returns an ok health status", () => {
    const result = new GetHealthQuery().execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ status: "ok" });
    }
  });
});
