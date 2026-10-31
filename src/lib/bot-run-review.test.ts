import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { listBotRunReviews } from "./bot-run-review";

test("runs applies dates before paging and count, retaining existing filters", async context => {
  const queries: unknown[] = [];
  const findMany = prisma.botRun.findMany;
  const count = prisma.botRun.count;
  prisma.botRun.findMany = (async (args: unknown) => { queries.push(args); return []; }) as typeof findMany;
  prisma.botRun.count = (async (args: unknown) => { queries.push(args); return 0; }) as typeof count;
  context.after(() => { prisma.botRun.findMany = findMany; prisma.botRun.count = count; });
  await listBotRunReviews({ from: "2026-10-31", to: "2026-10-31", status: "error", channel: "web", target: "knowledge_base", usedWebSearch: "false" }, 2, 12);
  const where = {
    createdAt: { gte: new Date("2026-10-30T17:00:00Z"), lt: new Date("2026-10-31T17:00:00Z") },
    status: "error", usedWebSearch: false,
    AND: [{ metadata: { path: ["channel"], equals: "web" } }, { metadata: { path: ["selectedTarget"], equals: "knowledge_base" } }]
  };
  assert.deepEqual(queries, [{ orderBy: { createdAt: "desc" }, skip: 12, take: 12, where }, { where }]);
});

test("runs rejects invalid dates before touching storage", async context => {
  const findMany = prisma.botRun.findMany;
  prisma.botRun.findMany = (async () => { assert.fail("invalid query reached storage"); }) as typeof findMany;
  context.after(() => { prisma.botRun.findMany = findMany; });
  await assert.rejects(listBotRunReviews({ from: "bad", to: "2026-10-31" }), /YYYY-MM-DD/);
});
