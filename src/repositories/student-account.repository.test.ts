import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

type Args = Record<string, unknown>;

async function repoWith(accounts: { lineUserId: string; email: string; verifiedAt: Date }[]) {
  const { StudentAccountRepository } = await import("./student-account.repository");
  const calls = { find: [] as Args[], runs: [] as Args[], tickets: [] as Args[] };
  const db = {
    user: { findMany: async (a: Args) => (calls.find.push(a), accounts) },
    botRun: {
      groupBy: async (a: Args) => (
        calls.runs.push(a),
        [{ lineUserId: "U1", _count: { _all: 3 }, _max: { createdAt: new Date("2026-10-01") } }]
      )
    },
    ticket: {
      groupBy: async (a: Args) => (calls.tickets.push(a), [{ lineUserId: "U1", _count: { _all: 1 } }])
    }
  };
  return { repo: new StudentAccountRepository(db as never), calls };
}

const studentWhere = { lineUserId: { not: null }, roles: { some: { role: { name: "student" } } } };
const verifiedAt = new Date("2026-09-01");
const two = [
  { lineUserId: "U1", email: "a@bumail.net", verifiedAt },
  { lineUserId: "U2", email: "b@bumail.net", verifiedAt }
];

test("list merges run and ticket counts per lineUserId", async () => {
  const { repo } = await repoWith(two);
  const [u1, u2] = await repo.list();
  assert.deepEqual(u1, { ...two[0], runs: 3, tickets: 1, lastActiveAt: new Date("2026-10-01") });
  assert.deepEqual(u2, { ...two[1], runs: 0, tickets: 0, lastActiveAt: null });
});

test("list filters by trimmed email, ignoring blank q", async () => {
  const { repo, calls } = await repoWith(two);
  await repo.list({ q: "  ab " });
  await repo.list({ q: "   " });
  assert.deepEqual(calls.find[0].where, { ...studentWhere, email: { contains: "ab", mode: "insensitive" } });
  assert.deepEqual(calls.find[1].where, studentWhere);
});

test("list orders newest first and caps at limit", async () => {
  const { repo, calls } = await repoWith(two);
  await repo.list();
  await repo.list({ limit: 5 });
  assert.deepEqual(calls.find[0].orderBy, { verifiedAt: "desc" });
  assert.equal(calls.find[0].take, 200);
  assert.equal(calls.find[1].take, 5);
});

type FakeUser = { id: string; email: string; lineUserId: string | null; verifiedAt: Date | null; disabledAt: Date | null; roles: Set<string> };

async function usersWith(...seed: Partial<FakeUser>[]) {
  const { StudentAccountRepository } = await import("./student-account.repository");
  const users: FakeUser[] = seed.map((u, i) => ({
    id: `u${i}`, email: "", lineUserId: null, verifiedAt: null, disabledAt: null, roles: new Set<string>(), ...u
  }));
  const pick = (w: { lineUserId?: string; email?: string }) =>
    users.find((u) => (w.lineUserId !== undefined ? u.lineUserId === w.lineUserId : u.email === w.email)) ?? null;
  const roleNames = { student: "r-student" } as Record<string, string>;
  const db = {
    user: {
      findUnique: async ({ where }: Args) => pick(where as never),
      findFirst: async ({ where }: Args) => {
        const w = where as { lineUserId: string; disabledAt: null; roles: unknown };
        const u = pick({ lineUserId: w.lineUserId });
        return u && !u.disabledAt && u.roles.has("student") ? u : null;
      },
      create: async ({ data }: Args) => {
        const d = data as { email: string; lineUserId: string; roles: { create: { roleId: string } } };
        const role = Object.keys(roleNames).find((k) => roleNames[k] === d.roles.create.roleId)!;
        users.push({ id: `u${users.length}`, email: d.email, lineUserId: d.lineUserId, verifiedAt: new Date(), disabledAt: null, roles: new Set([role]) });
        return {};
      },
      update: async ({ where, data }: Args) => {
        const u = users.find((x) => x.id === (where as { id: string }).id)!;
        Object.assign(u, data);
        return u;
      }
    },
    role: { findUnique: async ({ where }: Args) => ({ id: roleNames[(where as { name: string }).name] }) },
    userRole: {
      upsert: async ({ where }: Args) => {
        const w = (where as { userId_roleId: { userId: string } }).userId_roleId;
        users.find((x) => x.id === w.userId)!.roles.add("student");
        return {};
      },
      deleteMany: async ({ where }: Args) => {
        users.find((x) => x.id === (where as { userId: string }).userId)!.roles.delete("student");
        return {};
      }
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db)
  };
  return { repo: new StudentAccountRepository(db as never), users };
}

test("remove unlinks and drops only the student role, never deletes the user", async () => {
  const { repo, users } = await usersWith({ email: "a@bumail.net", lineUserId: "U1", verifiedAt, roles: new Set(["student", "admin"]) });
  assert.equal(await repo.remove({ lineUserId: "U1", confirmEmail: "other@bumail.net" }), "mismatch");
  assert.equal(users[0].lineUserId, "U1");
  assert.equal(await repo.remove({ lineUserId: "U1", confirmEmail: " A@Bumail.net " }), "deleted");
  assert.equal(users.length, 1);
  assert.equal(users[0].lineUserId, null);
  assert.equal(users[0].verifiedAt, null);
  assert.deepEqual([...users[0].roles], ["admin"]);
});

test("remove reports not_found without changing anything", async () => {
  const { repo, users } = await usersWith({ email: "a@bumail.net", lineUserId: "U1", roles: new Set(["student"]) });
  assert.equal(await repo.remove({ lineUserId: "U9", confirmEmail: "a@bumail.net" }), "not_found");
  assert.equal(users[0].lineUserId, "U1");
});

test("bind creates a student user, is unchanged on repeat, and reports line_taken", async () => {
  const { repo, users } = await usersWith();
  assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "bound");
  assert.deepEqual([...users[0].roles], ["student"]);
  assert.equal(await repo.bind({ lineUserId: "U1", email: "a@bumail.net" }), "unchanged");
  assert.equal(await repo.bind({ lineUserId: "U1", email: "b@bumail.net" }), "line_taken");
});

test("bind attaches LINE and student role to an existing admin user without adding admin", async () => {
  const { repo, users } = await usersWith({ email: "boss@bumail.net", roles: new Set(["admin"]) });
  assert.equal(await repo.bind({ lineUserId: "U7", email: "boss@bumail.net" }), "bound");
  assert.equal(users.length, 1);
  assert.equal(users[0].lineUserId, "U7");
  assert.ok(users[0].verifiedAt);
  assert.deepEqual([...users[0].roles].sort(), ["admin", "student"]);
});

test("bind returns email_taken when the email is linked to another LINE id", async () => {
  const { repo, users } = await usersWith({ email: "a@bumail.net", lineUserId: "U1", roles: new Set(["student"]) });
  assert.equal(await repo.bind({ lineUserId: "U2", email: "a@bumail.net" }), "email_taken");
  assert.equal(users.length, 1);
  assert.equal(users[0].lineUserId, "U1");
});

test("findByLineUserId ignores disabled users and users without the student role", async () => {
  const { repo, users } = await usersWith({ email: "a@bumail.net", lineUserId: "U1", roles: new Set(["student"]) });
  assert.deepEqual(await repo.findByLineUserId("U1"), { lineUserId: "U1", email: "a@bumail.net" });
  users[0].disabledAt = new Date();
  assert.equal(await repo.findByLineUserId("U1"), null);
  users[0].disabledAt = null;
  users[0].roles.clear();
  assert.equal(await repo.findByLineUserId("U1"), null);
});

test("list skips group queries when there are no accounts", async () => {
  const { repo, calls } = await repoWith([]);
  assert.deepEqual(await repo.list(), []);
  assert.equal(calls.runs.length + calls.tickets.length, 0);
});
