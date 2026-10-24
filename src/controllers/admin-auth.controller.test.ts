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

async function pwSetup(result: string = "ok", session: unknown = { userId: "u1", email: "a@bumail.net", roles: ["viewer"] }, limit: Limit = { allowed: true }) {
  const { AdminAuthController } = await import("./admin-auth.controller");
  const changes: unknown[][] = [];
  const auth = { authenticate: async () => session };
  const users = { changePassword: async (...args: unknown[]) => (changes.push(args), result) };
  const limits = { consume: async () => limit };
  const controller = new AdminAuthController(auth as never, limits as never, users as never);
  const post = (fields: Record<string, string>, origin = "http://localhost:3025") =>
    controller.changePassword(new Request("http://localhost:3025/api/admin/auth/password", {
      method: "POST", headers: { origin }, body: new URLSearchParams(fields)
    }));
  return { post, changes };
}

const pwFields = { currentPassword: "old-password-1", newPassword: "brand-new-pass", confirmPassword: "brand-new-pass" };

test("change password denies cross-origin and signed-out callers before any work", async () => {
  const cross = await pwSetup();
  assert.equal((await cross.post(pwFields, "http://evil.test")).status, 403);
  const anon = await pwSetup("ok", null);
  assert.equal((await anon.post(pwFields)).status, 401);
  assert.equal(cross.changes.length + anon.changes.length, 0);
});

test("change password redirects with the outcome and passes the session email", async () => {
  const ok = await pwSetup("ok");
  const done = await ok.post(pwFields);
  assert.equal(done.status, 303);
  assert.equal(done.headers.get("location"), "http://localhost:3025/admin/profile?password=ok");
  assert.deepEqual(ok.changes, [["a@bumail.net", "old-password-1", "brand-new-pass"]]);
  const wrong = await pwSetup("wrong_password");
  assert.equal((await wrong.post(pwFields)).headers.get("location"), "http://localhost:3025/admin/profile?password=wrong_password");
  const short = await pwSetup("too_short");
  assert.equal((await short.post(pwFields)).headers.get("location"), "http://localhost:3025/admin/profile?password=too_short");
});

test("change password rejects a mismatched confirmation and a missing field without calling the service", async () => {
  const s = await pwSetup();
  const mismatch = await s.post({ ...pwFields, confirmPassword: "different-pass" });
  assert.equal(mismatch.headers.get("location"), "http://localhost:3025/admin/profile?password=mismatch");
  const missing = await s.post({ newPassword: "brand-new-pass", confirmPassword: "brand-new-pass" });
  assert.equal(missing.headers.get("location"), "http://localhost:3025/admin/profile?password=wrong_password");
  assert.equal(s.changes.length, 0);
});

test("change password is rate limited before checking the current password", async () => {
  const s = await pwSetup("ok", undefined, { allowed: false, retryAfterSeconds: 30 });
  const res = await s.post(pwFields);
  assert.equal(res.status, 429);
  assert.equal(s.changes.length, 0);
});
