import assert from "node:assert/strict";
import { test } from "node:test";
import { adminAuthFixture, fixtureSecret } from "./test-support/admin-auth-fixture";

const seeds = [
  { email: "boss@bumail.net", password: "boss-pw", roles: ["admin"] },
  { email: "look@bumail.net", password: "look-pw", roles: ["viewer"] },
  { email: "off@bumail.net", password: "off-pw", roles: ["admin"], disabledAt: new Date() },
  { email: "stu@bumail.net", password: "stu-pw", roles: ["student"] },
  { email: "nopw@bumail.net", roles: ["admin"] }
];

test("login returns a token for an active admin or viewer", async () => {
  const f = await adminAuthFixture(...seeds);
  const admin = await f.service.getSession(await f.service.login(" Boss@BUmail.net ", "boss-pw") ?? undefined);
  assert.deepEqual(admin, { userId: f.users[0].id, email: "boss@bumail.net", roles: ["admin"] });
  const viewer = await f.service.getSession(await f.service.login("look@bumail.net", "look-pw") ?? undefined);
  assert.deepEqual(viewer?.roles, ["viewer"]);
});

test("login returns null for unknown email, wrong password, disabled user, student-only user and no password", async () => {
  const f = await adminAuthFixture(...seeds);
  for (const [email, pw] of [
    ["ghost@bumail.net", "x"], ["boss@bumail.net", "wrong"], ["off@bumail.net", "off-pw"],
    ["stu@bumail.net", "stu-pw"], ["nopw@bumail.net", "anything"]
  ]) {
    assert.equal(await f.service.login(email, pw), null, email);
  }
});

test("an unknown email still runs one password verification", async () => {
  const f = await adminAuthFixture(...seeds);
  await f.service.login("ghost@bumail.net", "x");
  assert.equal(f.verifies(), 1);
});

test("getSession reflects role changes and disabling immediately", async () => {
  const f = await adminAuthFixture(...seeds);
  const token = await f.tokenFor("boss@bumail.net", "boss-pw");
  assert.deepEqual((await f.service.getSession(token))?.roles, ["admin"]);
  f.users[0].roles = ["viewer"];
  assert.deepEqual((await f.service.getSession(token))?.roles, ["viewer"]);
  f.users[0].roles = ["student"];
  assert.equal(await f.service.getSession(token), null);
  f.users[0].roles = ["admin"];
  f.users[0].disabledAt = new Date();
  assert.equal(await f.service.getSession(token), null);
});

test("getSession rejects expired, tampered, old-format and wrong-secret tokens without throwing", async () => {
  const f = await adminAuthFixture(...seeds);
  const now = 1_800_000_000_000;
  const token = await f.tokenFor("boss@bumail.net", "boss-pw", now);
  assert.ok(await f.service.getSession(token, now + 1000));
  assert.equal(await f.service.getSession(token, now + 9 * 3600 * 1000), null);
  const [exp, , sig] = token.split(".");
  const other = f.users[1].id;
  const old = `${exp}.${"a".repeat(32)}.${sig}`;
  const foreign = await new f.AdminAuthService(`${fixtureSecret}-other`, f.repo)
    .login("boss@bumail.net", "boss-pw", now);
  for (const bad of [`${exp}.${other}.${sig}`, old, foreign ?? "", "", "garbage", "a.b.c", `${exp}.${f.users[0].id}.${"0".repeat(64)}`, undefined]) {
    assert.equal(await f.service.getSession(bad as string | undefined, now + 1000), null, String(bad));
  }
});

test("authorize: viewer read ok / viewer write forbidden / admin write ok / no cookie unauthenticated", async () => {
  const f = await adminAuthFixture(...seeds);
  const viewer = f.requestWith(await f.tokenFor("look@bumail.net", "look-pw"));
  const admin = f.requestWith(await f.tokenFor("boss@bumail.net", "boss-pw"));
  assert.equal(await f.service.authorize(viewer, "read"), "ok");
  assert.equal(await f.service.authorize(viewer, "write"), "forbidden");
  assert.equal(await f.service.authorize(admin, "write"), "ok");
  assert.equal(await f.service.authorize(admin, "read"), "ok");
  assert.equal(await f.service.authorize(f.requestWith(), "read"), "unauthenticated");
  assert.equal(await f.service.authorize(f.requestWith("junk"), "write"), "unauthenticated");
});

test("a secret without any users cannot log anyone in, and no secret means not configured", async () => {
  const f = await adminAuthFixture();
  assert.equal(f.service.configured, true);
  assert.equal(await f.service.login("boss@bumail.net", "boss-pw"), null);
  const off = new f.AdminAuthService("", { findByEmail: async () => null, findActiveById: async () => null });
  assert.equal(off.configured, false);
});
