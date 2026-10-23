import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bumailEmail, exchangeGoogleCode, googleAuthUrl, type GoogleIdClaims } from "./google-oidc";

const now = 1_800_000_000_000;
const base: GoogleIdClaims = {
  iss: "https://accounts.google.com",
  aud: "client-1",
  exp: now / 1000 + 600,
  nonce: "n1",
  email: "somchai.s@bumail.net",
  email_verified: true,
  hd: "bumail.net"
};

function jwt(claims: Partial<GoogleIdClaims>) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part({ ...base, ...claims })}.sig`;
}

function fakeFetch(response: { ok?: boolean; body: unknown }) {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: String(init.body) });
    return { ok: response.ok ?? true, json: async () => response.body };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const exchange = (fetchImpl: typeof fetch) =>
  exchangeGoogleCode({
    code: "code-1", clientId: "client-1", clientSecret: "secret-1",
    redirectUri: "https://app.test/cb", fetchImpl, now
  });

describe("googleAuthUrl", () => {
  test("contains scope openid email, hd, state and nonce", () => {
    const url = new URL(googleAuthUrl({
      clientId: "client-1", redirectUri: "https://app.test/cb", state: "s1", nonce: "n1", hd: "bumail.net"
    }));
    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("scope"), "openid email");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("hd"), "bumail.net");
    assert.equal(url.searchParams.get("state"), "s1");
    assert.equal(url.searchParams.get("nonce"), "n1");
    assert.equal(url.searchParams.get("client_id"), "client-1");
  });
});

describe("bumailEmail", () => {
  test("accepts verified bumail.net and lowercases", () => {
    assert.equal(bumailEmail({ ...base, email: "Name@BUmail.NET" }, "bumail.net"), "name@bumail.net");
  });

  test("rejects spoofed domains", () => {
    for (const email of ["a@evilbumail.net", "a@bumail.net.evil.com", "a@evil.com@bumail.net", "a@sub.bumail.net", "bumail.net", "a@"]) {
      assert.equal(bumailEmail({ ...base, email }, "bumail.net"), null, email);
    }
  });

  test("rejects unverified email", () => {
    assert.equal(bumailEmail({ ...base, email_verified: false }, "bumail.net"), null);
    assert.equal(bumailEmail({ ...base, email_verified: undefined }, "bumail.net"), null);
  });

  test("rejects missing or other hd", () => {
    assert.equal(bumailEmail({ ...base, hd: undefined }, "bumail.net"), null);
    assert.equal(bumailEmail({ ...base, hd: "gmail.com" }, "bumail.net"), null);
  });

  test("rejects missing email", () => {
    assert.equal(bumailEmail({ ...base, email: undefined }, "bumail.net"), null);
  });
});

describe("exchangeGoogleCode", () => {
  test("returns claims and posts code and redirect_uri", async () => {
    const { fetchImpl, calls } = fakeFetch({ body: { id_token: jwt({}) } });
    const claims = await exchange(fetchImpl);
    assert.equal(claims.email, "somchai.s@bumail.net");
    assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get("code"), "code-1");
    assert.equal(body.get("redirect_uri"), "https://app.test/cb");
    assert.equal(body.get("grant_type"), "authorization_code");
  });

  test("accepts bare accounts.google.com issuer", async () => {
    const { fetchImpl } = fakeFetch({ body: { id_token: jwt({ iss: "accounts.google.com" }) } });
    assert.equal((await exchange(fetchImpl)).iss, "accounts.google.com");
  });

  test("rejects wrong aud", async () => {
    const { fetchImpl } = fakeFetch({ body: { id_token: jwt({ aud: "other" }) } });
    await assert.rejects(exchange(fetchImpl));
  });

  test("rejects wrong iss", async () => {
    const { fetchImpl } = fakeFetch({ body: { id_token: jwt({ iss: "https://evil.example" }) } });
    await assert.rejects(exchange(fetchImpl));
  });

  test("rejects expired token", async () => {
    const { fetchImpl } = fakeFetch({ body: { id_token: jwt({ exp: now / 1000 - 1 }) } });
    await assert.rejects(exchange(fetchImpl));
  });

  test("rejects non-2xx response", async () => {
    const { fetchImpl } = fakeFetch({ ok: false, body: { error: "invalid_grant" } });
    await assert.rejects(exchange(fetchImpl));
  });

  test("rejects missing id_token", async () => {
    const { fetchImpl } = fakeFetch({ body: {} });
    await assert.rejects(exchange(fetchImpl));
  });
});
