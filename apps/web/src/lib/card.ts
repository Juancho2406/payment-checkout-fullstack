export type CardBrand = "VISA" | "MASTERCARD";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function detectCardBrand(pan: string): CardBrand | null {
  const digits = digitsOnly(pan);
  if (/^4/.test(digits)) {
    return "VISA";
  }
  const prefix2 = Number(digits.slice(0, 2));
  const prefix4 = Number(digits.slice(0, 4));
  if ((prefix2 >= 51 && prefix2 <= 55) || (prefix4 >= 2221 && prefix4 <= 2720)) {
    return "MASTERCARD";
  }
  return null;
}

export function luhnOk(pan: string): boolean {
  const digits = digitsOnly(pan);
  if (digits.length !== 16) {
    return false;
  }
  let sum = 0;
  let doubleIt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (doubleIt) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

export function cardLast4(pan: string): string {
  return digitsOnly(pan).slice(-4);
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isValidExpiry(value: string, now = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) {
    return false;
  }
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) {
    return false;
  }
  const expiresAt = new Date(year, month, 1);
  return expiresAt > now;
}

export function isValidCvc(value: string): boolean {
  return /^\d{3}$/.test(value.trim());
}

export function isValidCardholder(value: string): boolean {
  return value.trim().length >= 3;
}
