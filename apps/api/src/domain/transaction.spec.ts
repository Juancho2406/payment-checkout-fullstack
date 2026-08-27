import { generateReference, isValidReference } from "./transaction";

describe("generateReference", () => {
  it("builds CHK-YYYYMMDD plus six hex chars", () => {
    const reference = generateReference(new Date("2026-08-27T12:00:00.000Z"));
    expect(reference).toMatch(/^CHK-20260827-[0-9A-F]{6}$/);
  });
});

describe("isValidReference", () => {
  it("accepts a non-empty trimmed string up to 255 chars", () => {
    expect(isValidReference("CHK-20260827-AB12CD")).toBe(true);
    expect(isValidReference("")).toBe(false);
    expect(isValidReference(12)).toBe(false);
  });
});
