import {
  formatColombianPhone,
  isNonEmpty,
  isValidColombianPhone,
  isValidEmail,
  isValidFullName,
  liveColombianPhoneError,
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

  it("keeps only CO mobile digits while typing", () => {
    expect(formatColombianPhone("300-111-2233")).toBe("3001112233");
    expect(formatColombianPhone("573001112233")).toBe("3001112233");
    expect(formatColombianPhone("abc300")).toBe("300");
    expect(liveColombianPhoneError("200")).toBe("Usa un celular CO (3 + 9 dígitos)");
    expect(liveColombianPhoneError("300")).toBeUndefined();
    expect(liveColombianPhoneError("")).toBeUndefined();
  });

  it("treats whitespace-only as empty", () => {
    expect(isNonEmpty("  x  ")).toBe(true);
    expect(isNonEmpty("   ")).toBe(false);
  });
});
