import {
  isNonEmpty,
  isValidColombianPhone,
  isValidEmail,
  isValidFullName,
} from "./identity";

describe("identity validators", () => {
  it("accepts a trimmed email and rejects missing domains", () => {
    expect(isValidEmail(" ana@example.com ")).toBe(true);
    expect(isValidEmail("ana")).toBe(false);
  });

  it("requires a name of at least two characters", () => {
    expect(isValidFullName("Ana")).toBe(true);
    expect(isValidFullName(" A ")).toBe(false);
  });

  it("accepts Colombian mobiles with optional +57", () => {
    expect(isValidColombianPhone("3001112233")).toBe(true);
    expect(isValidColombianPhone("+57 300-111-2233")).toBe(true);
    expect(isValidColombianPhone("2001112233")).toBe(false);
  });

  it("treats whitespace-only as empty", () => {
    expect(isNonEmpty("  x  ")).toBe(true);
    expect(isNonEmpty("   ")).toBe(false);
  });
});
