import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

async function setup(result: "deleted" | "mismatch" | "not_found", authed = true) {
  const { StudentAdminController } = await import("./student-admin.controller");
  const calls: unknown[] = [];
  const repo = { remove: async (a: unknown) => (calls.push(a), result) };
  const auth = { isRequestAuthenticated: () => authed };
  const controller = new StudentAdminController(repo as never, auth as never);
  const request = (fields: Record<string, string>, origin = "http://localhost:3025") =>
    new Request("http://localhost:3025/api/admin/users/delete", {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams(fields)
    });
  return { controller, calls, request };
}

const fields = { lineUserId: "U1", confirmEmail: "a@bumail.net" };

test("delete denies unauthenticated and cross-origin callers before any work", async () => {
  const anon = await setup("deleted", false);
  assert.equal((await anon.controller.handleDelete(anon.request(fields))).status, 401);
  const cross = await setup("deleted");
  assert.equal((await cross.controller.handleDelete(cross.request(fields, "http://evil.test"))).status, 403);
  assert.equal(anon.calls.length + cross.calls.length, 0);
});

test("delete rejects missing fields without touching the repository", async () => {
  const s = await setup("deleted");
  assert.equal((await s.controller.handleDelete(s.request({ lineUserId: "U1" }))).status, 400);
  assert.equal(s.calls.length, 0);
});

test("delete maps repository results to redirect, 400 and 404", async () => {
  const ok = await setup("deleted");
  const done = await ok.controller.handleDelete(ok.request(fields));
  assert.equal(done.status, 303);
  assert.equal(done.headers.get("location"), "http://localhost:3025/admin/users");
  assert.deepEqual(ok.calls, [fields]);
  const bad = await setup("mismatch");
  assert.equal((await bad.controller.handleDelete(bad.request(fields))).status, 400);
  const gone = await setup("not_found");
  assert.equal((await gone.controller.handleDelete(gone.request(fields))).status, 404);
});
