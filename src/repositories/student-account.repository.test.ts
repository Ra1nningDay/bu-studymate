import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

type Args = Record<string, unknown>;

async function repoWith(accounts: { lineUserId: string; email: string; verifiedAt: Date }[]) {
  const { StudentAccountRepository } = await import("./student-account.repository");
  const calls = { find: [] as Args[], runs: [] as Args[], tickets: [] as Args[] };
  const db = {
    studentAccount: { findMany: async (a: Args) => (calls.find.push(a), accounts) },
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
  assert.deepEqual(calls.find[0].where, { email: { contains: "ab", mode: "insensitive" } });
  assert.equal(calls.find[1].where, undefined);
});

test("list orders newest first and caps at limit", async () => {
  const { repo, calls } = await repoWith(two);
  await repo.list();
  await repo.list({ limit: 5 });
  assert.deepEqual(calls.find[0].orderBy, { verifiedAt: "desc" });
  assert.equal(calls.find[0].take, 200);
  assert.equal(calls.find[1].take, 5);
});

async function removeWith(account: { email: string } | null) {
  const { StudentAccountRepository } = await import("./student-account.repository");
  const deleted: Args[] = [];
  const db = {
    studentAccount: {
      findUnique: async () => account,
      delete: async (a: Args) => (deleted.push(a), {})
    }
  };
  return { repo: new StudentAccountRepository(db as never), deleted };
}

test("remove deletes only when the typed email matches, ignoring case and spaces", async () => {
  const { repo, deleted } = await removeWith({ email: "a@bumail.net" });
  assert.equal(await repo.remove({ lineUserId: "U1", confirmEmail: "other@bumail.net" }), "mismatch");
  assert.equal(deleted.length, 0);
  assert.equal(await repo.remove({ lineUserId: "U1", confirmEmail: " A@Bumail.net " }), "deleted");
  assert.deepEqual(deleted, [{ where: { lineUserId: "U1" } }]);
});

test("remove reports not_found without deleting", async () => {
  const { repo, deleted } = await removeWith(null);
  assert.equal(await repo.remove({ lineUserId: "U9", confirmEmail: "a@bumail.net" }), "not_found");
  assert.equal(deleted.length, 0);
});

test("list skips group queries when there are no accounts", async () => {
  const { repo, calls } = await repoWith([]);
  assert.deepEqual(await repo.list(), []);
  assert.equal(calls.runs.length + calls.tickets.length, 0);
});
