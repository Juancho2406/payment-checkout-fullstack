import { digitsOnly } from "./card";
import type { CardSession } from "./card-session";

export type CardToTokenize = {
  readonly number: string;
  readonly cvc: string;
  readonly expMonth: string;
  readonly expYear: string;
  readonly cardHolder: string;
};

export type PspBrowserTokens = {
  readonly paymentToken: string;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuth?: string;
};

export type TokenizeDeps = {
  readonly baseUrl?: string;
  readonly publicKey?: string;
  readonly fetchImpl?: typeof fetch;
};

export function pspBrowserConfig(): { baseUrl: string; publicKey: string } {
  const baseUrl = String(import.meta.env.VITE_PSP_BASE_URL ?? "").replace(/\/$/, "");
  const publicKey = String(import.meta.env.VITE_PSP_PUBLIC_KEY ?? "");
  return { baseUrl, publicKey };
}

export function cardSessionToTokenizeInput(card: CardSession): CardToTokenize {
  const [expMonth, expYear] = card.expiry.split("/");
  return {
    number: digitsOnly(card.pan),
    cvc: card.cvc,
    expMonth,
    expYear,
    cardHolder: card.cardholder,
  };
}

export async function tokenizeCard(
  card: CardToTokenize,
  deps: TokenizeDeps = {},
): Promise<PspBrowserTokens> {
  const baseUrl = (deps.baseUrl ?? pspBrowserConfig().baseUrl).replace(/\/$/, "");
  const publicKey = deps.publicKey ?? pspBrowserConfig().publicKey;
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (!baseUrl || !publicKey) {
    throw new Error("Falta configurar la llave pública del PSP");
  }

  const acceptance = await fetchAcceptanceTokens(baseUrl, publicKey, fetchImpl);
  const paymentToken = await createCardToken(baseUrl, publicKey, card, fetchImpl);
  return {
    paymentToken,
    acceptanceToken: acceptance.acceptanceToken,
    acceptPersonalAuth: acceptance.acceptPersonalAuth,
  };
}

async function fetchAcceptanceTokens(
  baseUrl: string,
  publicKey: string,
  fetchImpl: typeof fetch,
): Promise<{ acceptanceToken: string; acceptPersonalAuth?: string }> {
  const response = await fetchImpl(
    `${baseUrl}/merchants/${encodeURIComponent(publicKey)}`,
    { method: "GET" },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("No se pudo obtener el token de aceptación");
  }
  const data = unwrapData(payload);
  const acceptanceToken = readNestedToken(data, "presigned_acceptance");
  if (!acceptanceToken) {
    throw new Error("No se pudo obtener el token de aceptación");
  }
  const acceptPersonalAuth = readNestedToken(data, "presigned_personal_data_auth");
  return acceptPersonalAuth
    ? { acceptanceToken, acceptPersonalAuth }
    : { acceptanceToken };
}

async function createCardToken(
  baseUrl: string,
  publicKey: string,
  card: CardToTokenize,
  fetchImpl: typeof fetch,
): Promise<string> {
  const response = await fetchImpl(`${baseUrl}/tokens/cards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publicKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: card.number,
      cvc: card.cvc,
      exp_month: card.expMonth,
      exp_year: card.expYear,
      card_holder: card.cardHolder,
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("El PSP rechazó la tarjeta");
  }
  const data = unwrapData(payload);
  const id = data && typeof data === "object" ? (data as { id?: unknown }).id : null;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("El PSP rechazó la tarjeta");
  }
  return id;
}

function unwrapData(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { data?: unknown };
  if (record.data && typeof record.data === "object") {
    return record.data as Record<string, unknown>;
  }
  return record as Record<string, unknown>;
}

function readNestedToken(
  data: Record<string, unknown> | null,
  key: string,
): string | undefined {
  if (!data) {
    return undefined;
  }
  const nested = data[key];
  if (!nested || typeof nested !== "object") {
    return undefined;
  }
  const token = (nested as { acceptance_token?: unknown }).acceptance_token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}
