import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

const secret = "fixture-student-secret-0123456789abcdef";
const now = 1_800_000_000_000;
let signToken: typeof import("./signed-token").signToken;
let verifyToken: typeof import("./signed-token").verifyToken;
let Repository: typeof import("@/src/repositories/student-account.repository").StudentAccountRepository;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ signToken, verifyToken } = await import("./signed-token"));
  ({ StudentAccountRepository: Repository } = await import("@/src/repositories/student-account.repository"));
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

function fakeDb() {
  const rows: { id: string; lineUserId: string; email: string }[] = [];
  const studentAccount = {
    findUnique: async ({ where }: { where: { lineUserId?: string; email?: string } }) =>
      rows.find((row) => (where.lineUserId ? row.lineUserId === where.lineUserId : row.email === where.email)) ?? null,
    create: async ({ data }: { data: { lineUserId: string; email: string } }) => {
      rows.push({ id: String(rows.length + 1), ...data });
    }
  };
  const db = { studentAccount, $transaction: async (fn: (tx: unknown) => unknown) => fn({ studentAccount }) };
  return { rows, repo: new Repository(db as never) };
}

describe("student account repository", () => {
  test("bind new pair returns bound", async () => {
    const { rows, repo } = fakeDb();
    assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "bound");
    assert.equal(rows.length, 1);
  });

  test("same pair again returns unchanged", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "unchanged");
    assert.equal(rows.length, 1);
  });

  test("same email from another LINE user returns email_taken and writes nothing", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U2", email: "a@bumail.net" }), "email_taken");
    assert.deepEqual(rows.map((row) => row.lineUserId), ["U1"]);
  });

  test("same LINE user with another email returns line_taken and writes nothing", async () => {
    const { rows, repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal(await repo.bind({ lineUserId: "U1", email: "b@bumail.net" }), "line_taken");
    assert.deepEqual(rows.map((row) => row.email), ["a@bumail.net"]);
  });

  test("findByLineUserId returns the binding or null", async () => {
    const { repo } = fakeDb();
    await repo.bind({ lineUserId: "U1", email: "a@bumail.net" });
    assert.equal((await repo.findByLineUserId("U1"))?.email, "a@bumail.net");
    assert.equal(await repo.findByLineUserId("U9"), null);
  });
});
