import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPassword } from "./password";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

type Row = { id: string; email: string; passwordHash: string | null; disabledAt: Date | null; roles: string[] };

async function setup(...seed: Row[]) {
  const { AdminUserService } = await import("./admin-user.service");
  const rows = [...seed];
  const repo = {
    findByEmail: async (email: string) => rows.find((r) => r.email === email.trim().toLowerCase()) ?? null,
    // Mirrors the real repository: the hash is only applied to a user that has none.
    upsertWithRole: async (email: string, role: string, passwordHash: string | null) => {
      let row = rows.find((r) => r.email === email);
      if (!row) rows.push((row = { id: `u${rows.length}`, email, passwordHash, disabledAt: null, roles: [] }));
      else if (!row.passwordHash) row.passwordHash = passwordHash;
      if (!row.roles.includes(role)) row.roles.push(role);
    },
    setPasswordHash: async (email: string, passwordHash: string) => {
      rows.find((r) => r.email === email)!.passwordHash = passwordHash;
    }
  };
  return { service: new AdminUserService(repo), rows };
}

test("provision lowercases the email and returns a password that verifies against the stored hash", async () => {
  const { service, rows } = await setup();
  const { password } = await service.provision("  Boss@BUmail.net ", "admin");
  assert.equal(rows[0].email, "boss@bumail.net");
  assert.deepEqual(rows[0].roles, ["admin"]);
  assert.ok(password && password.length >= 24);
  assert.equal(await verifyPassword(password, rows[0].passwordHash!), true);
});

test("provision rejects roles other than admin and viewer", async () => {
  const { service, rows } = await setup();
  for (const role of ["student", "root", ""]) await assert.rejects(() => service.provision("a@bumail.net", role as never));
  assert.equal(rows.length, 0);
});

test("an existing email gains the role without changing its password", async () => {
  const { service, rows } = await setup({ id: "u0", email: "a@bumail.net", passwordHash: "scrypt$old", disabledAt: null, roles: ["student"] });
  assert.deepEqual(await service.provision("a@bumail.net", "viewer"), { password: null });
  assert.equal(rows[0].passwordHash, "scrypt$old");
  assert.deepEqual(rows[0].roles, ["student", "viewer"]);
});

test("an existing user without a password gets one so they can sign in", async () => {
  const { service, rows } = await setup({ id: "u0", email: "a@bumail.net", passwordHash: null, disabledAt: null, roles: ["student"] });
  const { password } = await service.provision("a@bumail.net", "admin");
  assert.ok(password);
  assert.equal(await verifyPassword(password, rows[0].passwordHash!), true);
});

test("resetPassword replaces the hash for an admin, and throws for unknown or student-only users", async () => {
  const { service, rows } = await setup(
    { id: "u0", email: "a@bumail.net", passwordHash: "scrypt$old", disabledAt: null, roles: ["admin"] },
    { id: "u1", email: "s@bumail.net", passwordHash: null, disabledAt: null, roles: ["student"] }
  );
  const { password } = await service.resetPassword("A@bumail.net");
  assert.equal(await verifyPassword(password, rows[0].passwordHash!), true);
  await assert.rejects(() => service.resetPassword("ghost@bumail.net"), { message: "User not found" });
  await assert.rejects(() => service.resetPassword("s@bumail.net"), { message: "User not found" });
  assert.equal(rows[1].passwordHash, null);
});
