import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const secret = "fixture-student-secret-0123456789abcdef";
const now = 1_800_000_000_000;
let signToken: typeof import("./signed-token").signToken;
let verifyToken: typeof import("./signed-token").verifyToken;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ signToken, verifyToken } = await import("./signed-token"));
});

describe("signed token", () => {
  test("signed token round-trips", () => {
    const token = signToken({ typ: "link", lineUserId: "U1" }, secret, 600, now);
    const payload = verifyToken<{ typ: "link"; lineUserId: string }>(token, secret, "link", now + 1000);
    assert.equal(payload?.lineUserId, "U1");
  });

  test("rejects tampered payload", () => {
    const token = signToken({ typ: "link", lineUserId: "U1" }, secret, 600, now);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ typ: "link", lineUserId: "U2", exp: now + 600_000 })).toString("base64url");
    assert.equal(verifyToken(`${forged}.${signature}`, secret, "link", now), null);
  });

  test("rejects tampered signature", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    assert.equal(verifyToken(flipped, secret, "link", now), null);
  });

  test("rejects expired token", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    assert.equal(verifyToken(token, secret, "link", now + 600_001), null);
  });

  test("rejects wrong typ", () => {
    const token = signToken({ typ: "session" }, secret, 600, now);
    assert.equal(verifyToken(token, secret, "link", now), null);
  });

  test("rejects wrong secret", () => {
    const token = signToken({ typ: "link" }, secret, 600, now);
    assert.equal(verifyToken(token, `${secret}-other`, "link", now), null);
  });

  test("rejects undefined and malformed input", () => {
    for (const input of [undefined, "", "abc", "a.b.c", ".", "!!!.???"]) {
      assert.equal(verifyToken(input, secret, "link", now), null);
    }
  });
});
