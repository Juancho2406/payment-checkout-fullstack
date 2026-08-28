export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidFullName(value: string): boolean {
  return value.trim().length >= 2;
}

/** CO mobile: optional +57, then 3 and nine more digits. */
export function isValidColombianPhone(value: string): boolean {
  return /^(?:\+57)?3\d{9}$/.test(value.replace(/[\s-]/g, ""));
}

/** Digits only, CO mobile (optional 57 country code stripped), max 10. */
export function formatColombianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length > 10) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

export function liveColombianPhoneError(value: string): string | undefined {
  if (value.length === 0) {
    return undefined;
  }
  if (!value.startsWith("3")) {
    return "Usa un celular CO (3 + 9 dígitos)";
  }
  if (value.length === 10 && !isValidColombianPhone(value)) {
    return "Usa un celular CO (3 + 9 dígitos)";
  }
  return undefined;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
