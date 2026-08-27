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

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
