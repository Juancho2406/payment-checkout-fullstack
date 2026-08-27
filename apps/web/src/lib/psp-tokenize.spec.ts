import { tokenizeCard } from "./psp-tokenize";

describe("tokenizeCard", () => {
  const card = {
    number: "4111111111111111",
    cvc: "123",
    expMonth: "12",
    expYear: "29",
    cardHolder: "ANA PEREZ",
  };

  it("asks the PSP (public key) for acceptance + card token, never our API", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/merchants/")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              presigned_acceptance: { acceptance_token: "eyJ-acceptance" },
              presigned_personal_data_auth: { acceptance_token: "eyJ-personal" },
            },
          }),
        };
      }
      if (url.includes("/tokens/cards")) {
        return {
          ok: true,
          json: async () => ({
            status: "CREATED",
            data: { id: "tok_test_visa", brand: "VISA", last_four: "1111" },
          }),
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      tokenizeCard(card, {
        baseUrl: "https://psp.example/v1",
        publicKey: "pub_test_fake",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      paymentToken: "tok_test_visa",
      acceptanceToken: "eyJ-acceptance",
      acceptPersonalAuth: "eyJ-personal",
    });

    const urls = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/api/"))).toBe(false);
    expect(urls[0]).toContain("/merchants/pub_test_fake");
    expect(urls[1]).toBe("https://psp.example/v1/tokens/cards");
    const tokenRequest = fetchImpl.mock.calls[1]?.[1];
    expect(tokenRequest?.headers).toMatchObject({
      Authorization: "Bearer pub_test_fake",
    });
    expect(String(tokenRequest?.body)).toContain("4111111111111111");
  });

  it("fails clearly when the public key is missing", async () => {
    await expect(
      tokenizeCard(card, { baseUrl: "", publicKey: "", fetchImpl: vi.fn() as unknown as typeof fetch }),
    ).rejects.toThrow("Falta configurar la llave pública del PSP");
  });
});
