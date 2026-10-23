import { createHmac, timingSafeEqual } from "node:crypto";

type Typed = { typ: string };

function mac(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest();
}

export function signToken(payload: Typed & Record<string, unknown>, secret: string, ttlSeconds: number, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlSeconds * 1000 })).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function verifyToken<T extends Typed>(token: string | undefined, secret: string, typ: T["typ"], now = Date.now()): T | null {
  const parts = token?.split(".");
  if (parts?.length !== 2) return null;
  const [body, signature] = parts;
  const expected = mac(body, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: number };
    return payload.typ === typ && typeof payload.exp === "number" && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
