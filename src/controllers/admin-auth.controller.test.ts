import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

type Limit = { allowed: boolean; retryAfterSeconds?: number };

async function setup(limit: Limit | Error = { allowed: true }, token: string | null = "tok") {
  const { AdminAuthController } = await import("./admin-auth.controller");
  const consumed: unknown[] = [];
  let sessions = 0;
  const logins: unknown[][] = [];
  const auth = { login: async (...args: unknown[]) => (sessions++, logins.push(args), token) };
  const limits = {
    consume: async (input: unknown) => {
      consumed.push(input);
      if (limit instanceof Error) throw limit;
      return limit;
    }
  };
  const controller = new AdminAuthController(auth as never, limits as never);
  const login = (headers: Record<string, string> = {}) =>
    controller.login(new Request("http://localhost:3025/api/admin/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3025", ...headers },
      body: new URLSearchParams({ email: "boss@bumail.net", password: "pw" })
    }));
  return { login, consumed, logins, sessions: () => sessions };
}

test("clientKey takes the first forwarded address, else unknown", async () => {
  const { clientKey } = await import("./admin-auth.controller");
  const req = (h: Record<string, string>) => new Request("http://x.test", { headers: h });
  assert.equal(clientKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientKey(req({ "x-forwarded-for": " 9.9.9.9 " })), "9.9.9.9");
  assert.equal(clientKey(req({})), "unknown");
});

test("over the limit returns 429 with Retry-After and no cookie, even with the right password", async () => {
  const s = await setup({ allowed: false, retryAfterSeconds: 120 });
  const res = await s.login({ "x-forwarded-for": "1.2.3.4" });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "120");
  assert.equal(res.headers.get("set-cookie"), null);
  assert.equal(s.sessions(), 0);
});

test("allowed attempts keep the existing success and failure redirects", async () => {
  const ok = await setup({ allowed: true }, "tok");
  const done = await ok.login({ "x-forwarded-for": "1.2.3.4" });
  assert.equal(done.status, 303);
  assert.equal(new URL(done.headers.get("location")!).pathname, "/admin");
  assert.match(done.headers.get("set-cookie") ?? "", /studymate-admin=tok/);
  assert.deepEqual(ok.logins, [["boss@bumail.net", "pw"]]);
  const { adminLoginRateLimitConfig } = await import("@/src/services/rate-limit.service");
  assert.deepEqual(ok.consumed, [{ lineUserId: "1.2.3.4", ...adminLoginRateLimitConfig }]);
  const bad = await setup({ allowed: true }, null);
  const failed = await bad.login();
  assert.equal(failed.headers.get("location"), "http://localhost:3025/login?login=failed");
  assert.equal(failed.headers.get("set-cookie"), null);
});

test("a failing limiter does not block login", async () => {
  const s = await setup(new Error("db down"));
  const res = await s.login();
  assert.equal(res.status, 303);
  assert.match(res.headers.get("set-cookie") ?? "", /studymate-admin=tok/);
});

test("cross-origin login is rejected before consuming the limit", async () => {
  const s = await setup();
  const res = await s.login({ origin: "http://evil.test" });
  assert.equal(res.status, 403);
  assert.equal(s.consumed.length, 0);
});
