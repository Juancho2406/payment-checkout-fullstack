import { formatCopFromCents } from "./money";

describe("formatCopFromCents", () => {
  it("divides integer cents and formats as COP", () => {
    const formatted = formatCopFromCents(12_990_000);
    expect(formatted.replace(/[^\d]/g, "")).toContain("129900");
  });
});
