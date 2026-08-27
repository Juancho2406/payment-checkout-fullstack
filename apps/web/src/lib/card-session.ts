export type CardSession = {
  readonly pan: string;
  readonly cvc: string;
  readonly expiry: string;
  readonly cardholder: string;
};

export type IssuedPspTokens = {
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuth?: string;
};

let cardSession: CardSession | null = null;
let issuedTokens: IssuedPspTokens | null = null;

export function saveCardSession(card: CardSession): void {
  cardSession = card;
  issuedTokens = null;
}

export function peekCardSession(): CardSession | null {
  return cardSession;
}

export function takeCardSession(): CardSession | null {
  const current = cardSession;
  cardSession = null;
  return current;
}

export function saveIssuedTokens(tokens: IssuedPspTokens): void {
  issuedTokens = tokens;
}

export function peekIssuedTokens(): IssuedPspTokens | null {
  return issuedTokens;
}

export function takeIssuedTokens(): IssuedPspTokens | null {
  const current = issuedTokens;
  issuedTokens = null;
  return current;
}

/** Drop PAN/CVC and any one-shot PSP tokens. Not Redux, not localStorage. */
export function clearBrowserCardSecrets(): void {
  cardSession = null;
  issuedTokens = null;
}
