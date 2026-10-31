import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { PlaygroundService } from "./playground.service";
import type { ChatOrchestrationService } from "./chat-orchestration.service";
import type { RateLimitService } from "./rate-limit.service";
import type { PlaygroundConversation } from "@/src/dtos/playground.dto";
import { standardAdminFixture } from "./test-support/admin-auth-fixture";

const sessionId = "playground-12345678-1234-4123-8123-123456789abc";
const origin = "http://localhost:3025";

let AuthController: typeof import("@/src/controllers/admin-auth.controller").AdminAuthController;
let Controller: typeof import("@/src/controllers/playground.controller").PlaygroundController;
let Service: typeof import("./playground.service").PlaygroundService;
let Repository: typeof import("@/src/repositories/playground.repository").PlaygroundRepository;
let presenter: typeof import("@/src/presenters/playground.presenter").presentPlaygroundConversation;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ AdminAuthController: AuthController } = await import("@/src/controllers/admin-auth.controller"));
  ({ PlaygroundController: Controller } = await import("@/src/controllers/playground.controller"));
  ({ PlaygroundService: Service } = await import("./playground.service"));
  ({ PlaygroundRepository: Repository } = await import("@/src/repositories/playground.repository"));
  ({ presentPlaygroundConversation: presenter } = await import("@/src/presenters/playground.presenter"));
});

async function fixture() {
  const { service: auth, adminToken: token, viewerToken } = await standardAdminFixture();
  const calls: string[] = [];
  const conversation: PlaygroundConversation = {
    sessionId, createdAt: "2026-10-12T00:00:00Z", state: "IDLE", messages: [], runs: []
  };
  const service = {
    listSessions: async () => { calls.push("list"); return [conversation]; },
    getConversation: async (id: string) => { calls.push(`read:${id}`); return id === sessionId ? conversation : null; }
  } as unknown as PlaygroundService;
  const chat = {
    createBotReply: async (input: { channel: string; lineUserId: string; message: string }) => {
      calls.push(`send:${input.channel}:${input.lineUserId}:${input.message}`);
      return { text: "Synthetic reply", runId: "stored-run" };
    }
  } as unknown as ChatOrchestrationService;
  const limiter = { consume: async () => { calls.push("limit"); return { allowed: true }; } } as unknown as RateLimitService;
  const controller = new Controller(auth, service, chat, limiter);
  function request(path: string, body?: unknown, authenticated = true, source = origin, asToken = token) {
    return new Request(`${origin}/api/admin/playground/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: source, "Content-Type": "application/json",
        ...(authenticated ? { cookie: `studymate-admin=${asToken}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  }
  return { auth, token, viewerToken, controller, authController: new AuthController(auth, { consume: async () => ({ allowed: true }) } as never), calls, service, chat, limiter, request };
}

test("unauthenticated reads and sends never reach storage, AI or rate limiting", async () => {
  const f = await fixture();
  assert.equal((await f.controller.list(f.request("sessions", undefined, false))).status, 401);
  assert.equal((await f.controller.read(f.request("sessions/id", undefined, false), sessionId)).status, 401);
  assert.equal((await f.controller.send(f.request("message", { sessionId, message: "hello" }, false))).status, 401);
  assert.deepEqual(f.calls, []);
});

test("cross-origin sends, login and logout fail before mutation", async () => {
  const f = await fixture();
  const req = f.request("message", { sessionId, message: "hello" }, true, "https://other.example");
  assert.equal((await f.controller.send(req)).status, 403);
  assert.equal((await f.authController.login(f.request("login", {}, true, "https://other.example"))).status, 403);
  assert.equal((await f.authController.logout(f.request("logout", {}, true, "https://other.example"))).status, 403);
  assert.deepEqual(f.calls, []);
});

test("login submits by POST and sets a protected cookie without placing credentials in URLs", async () => {
  const f = await fixture();
  const form = new URLSearchParams({ email: "boss@bumail.net", password: "boss-pw" });
  const response = await f.authController.login(new Request(`${origin}/api/admin/playground/login`, {
    method: "POST", headers: { origin }, body: form
  }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${origin}/admin`);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=lax/i);
  assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /boss-pw/);
  const logout = await f.authController.logout(f.request("logout", {}));
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});

test("viewer can list and read sessions but cannot send", async () => {
  const f = await fixture();
  assert.equal((await f.controller.list(f.request("sessions", undefined, true, origin, f.viewerToken))).status, 200);
  assert.equal((await f.controller.read(f.request("sessions/id", undefined, true, origin, f.viewerToken), sessionId)).status, 200);
  assert.equal((await f.controller.send(f.request("message", { sessionId, message: "hello" }, true, origin, f.viewerToken))).status, 403);
  assert.deepEqual(f.calls, ["list", `read:${sessionId}`]);
});

test("rejects LINE identities, ordinary web sessions, blank messages and oversized input before storage", async () => {
  const f = await fixture();
  for (const body of [
    { sessionId: "U123", message: "hello" },
    { sessionId: "browser-123", message: "hello" },
    { sessionId, message: "   " },
    { sessionId, message: "x".repeat(10001) }
  ]) assert.equal((await f.controller.send(f.request("message", body))).status, 400);
  assert.equal((await f.controller.read(f.request("sessions/U123"), "U123")).status, 400);
  assert.deepEqual(f.calls, []);
});

test("login uses the browser host and forwarded scheme when Next has an internal request URL", async () => {
  const f = await fixture();
  const response = await f.authController.login(new Request("http://localhost:3025/api/admin/playground/login", {
    method: "POST", headers: { origin: "https://studymate.example", host: "studymate.example", "x-forwarded-proto": "https" },
    body: new URLSearchParams({ email: "boss@bumail.net", password: "boss-pw" })
  }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://studymate.example/admin");
});

test("valid send uses shared orchestration with web identity, normal quota and exact saved run ID", async () => {
  const f = await fixture();
  const response = await f.controller.send(f.request("message", { sessionId, message: " hello " }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { runId: "stored-run", reply: "Synthetic reply" });
  assert.deepEqual(f.calls, ["limit", `send:web:web-chat-${sessionId}:hello`]);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("quota rejection does not call orchestration", async () => {
  const f = await fixture();
  f.limiter.consume = async () => ({ allowed: false, retryAfterSeconds: 42 });
  const response = await f.controller.send(f.request("message", { sessionId, message: "hello" }));
  assert.equal(response.status, 429);
  assert.equal((await response.json()).retryAfterSeconds, 42);
  assert.deepEqual(f.calls, []);
});

test("provider/storage errors return a safe failure and read-back never replays the send", async () => {
  const f = await fixture();
  f.chat.createBotReply = async () => { throw new Error("sensitive provider credential"); };
  const response = await f.controller.send(f.request("message", { sessionId, message: "hello" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sensitive provider credential/);
  const read = await f.controller.read(f.request("sessions/id"), sessionId);
  assert.equal(read.status, 200);
  assert.deepEqual(f.calls, ["limit", `read:${sessionId}`]);
});

test("session reads are private, a missing session is 404, database failure is 503", async () => {
  const f = await fixture();
  const read = await f.controller.read(f.request("sessions/id"), sessionId);
  assert.match(read.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await f.controller.read(f.request("sessions/id"), sessionId.replace("789abc", "789abd"))).status, 404);
  f.service.listSessions = async () => { throw new Error("secret DB URL"); };
  const failed = await f.controller.list(f.request("sessions"));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret DB URL/);
});

test("service validates session boundary even when called directly by report pages", async () => {
  let reads = 0;
  const service = new Service({
    listSessions: async () => [
      { lineUserId: `web-chat-${sessionId}`, createdAt: new Date(), state: "IDLE" },
      { lineUserId: "U123", createdAt: new Date(), state: "IDLE" }
    ],
    getConversation: async () => { reads += 1; return null; }
  });
  assert.deepEqual((await service.listSessions()).map((session) => session.sessionId), [sessionId]);
  await assert.rejects(() => service.getConversation("U123"));
  assert.equal(reads, 0);
});

test("repository reads the complete web transcript and runs only for the playground identity", async () => {
  const { prisma } = await import("@/lib/prisma");
  const original = { session: prisma.chatSession.findUnique, messages: prisma.chatMessage.findMany, runs: prisma.botRun.findMany };
  const queries: unknown[] = [];
  prisma.chatSession.findUnique = (async (query: unknown) => { queries.push(query); return { lineUserId: `web-chat-${sessionId}` }; }) as typeof prisma.chatSession.findUnique;
  prisma.chatMessage.findMany = (async (query: unknown) => { queries.push(query); return []; }) as typeof prisma.chatMessage.findMany;
  prisma.botRun.findMany = (async (query: unknown) => { queries.push(query); return []; }) as typeof prisma.botRun.findMany;
  try {
    await new Repository().getConversation(sessionId);
    assert.deepEqual(queries, [
      { where: { lineUserId: `web-chat-${sessionId}` } },
      { where: { lineUserId: `web-chat-${sessionId}`, channel: "web" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      { where: { lineUserId: `web-chat-${sessionId}`, metadata: { path: ["channel"], equals: "web" } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }
    ]);
  } finally {
    prisma.chatSession.findUnique = original.session;
    prisma.chatMessage.findMany = original.messages;
    prisma.botRun.findMany = original.runs;
  }
});

test("presenter preserves failed/unlinked turns, source text and zero metrics; rejects malformed logs", () => {
  const data = {
    session: { lineUserId: `web-chat-${sessionId}`, state: "IDLE", createdAt: new Date("2026-10-12T00:00:00Z") },
    messages: [{ id: "assistant", role: "assistant", content: "<script>alert(1)</script>", createdAt: new Date(), metadata: { sourceUrls: ["https://bu.ac.th", 5] } }],
    runs: [{ id: "failed", status: "error", userMessageId: "user", assistantMessageId: null, createdAt: new Date(), intent: "UNKNOWN", errorCode: "Error", latencyMs: 0, usedWebSearch: false, usedStudyMemory: false, usedTicketFlow: false, metadata: { tokensUsed: 0, routerConfidence: 0, executionLog: [null, 5, { action: 3 }, { action: "Error", details: "Stored failure" }] } }]
  } as unknown as NonNullable<Awaited<ReturnType<InstanceType<typeof Repository>["getConversation"]>>>;
  const output = presenter(data);
  assert.equal(output.messages[0].text, "<script>alert(1)</script>");
  assert.deepEqual(output.messages[0].sources, ["https://bu.ac.th"]);
  assert.equal(output.runs[0].assistantMessageId, null);
  assert.equal(output.runs[0].tokensUsed, 0);
  assert.equal(output.runs[0].routerConfidence, 0);
  assert.equal(output.runs[0].latencyMs, 0);
  assert.deepEqual(output.runs[0].executionLog, [{ action: "Error", details: "Stored failure" }]);
});

test("shared orchestration returns the persisted run ID without changing reply behavior", async () => {
  const { createConciseChatFixture } = await import("@/evals/concise-chat/fixtures");
  const fixture = await createConciseChatFixture();
  // A deterministic guide bypasses model calls and still persists the turn.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Static guide must not call a provider"); };
  try {
    const reply = await fixture.service.createBotReply({ channel: "web", lineUserId: `web-chat-${sessionId}`, message: "อัปโหลดบทเรียน" });
    assert.equal(reply.runId, "synthetic-run-1");
    assert.equal(fixture.updates[0].status, "success");
    assert.equal(fixture.messages[1].content, reply.text);
    assert.equal((fixture.updates[0].metadata as Record<string, unknown>).routerType, "hard_guard");
  } finally { globalThis.fetch = originalFetch; }
});

test("presenter retains bounded RAG details and drops invalid telemetry without losing legacy actions", () => {
  const chunk = { id: "chunk", title: "Wi-Fi", sourceUrl: "https://bu.ac.th/wifi", content: "<script>fixture</script>",
    rank: 8, selectedRank: 1, rrfScore: 0.016, similarity: 0.8, keywordRank: null, vectorRank: 8 };
  const logs = [
    { action: "Query Rewrite", durationMs: 0, status: "skipped", rag: { originalQuery: "iPhone", query: "Wi-Fi iPhone", tokens: 0 } },
    { action: "Reranker", durationMs: 12, status: "applied", rag: { chunks: [chunk] } },
    { action: "Legacy", details: "Existing step" },
    { action: "Malformed", durationMs: -1, status: "made-up", rag: { chunks: [{ ...chunk, rank: -2 }] } }
  ];
  const data = { session: { lineUserId: `web-chat-${sessionId}`, state: "IDLE", createdAt: new Date() }, messages: [],
    runs: [{ id: "run", status: "success", createdAt: new Date(), metadata: { executionLog: logs } }]
  } as unknown as NonNullable<Awaited<ReturnType<InstanceType<typeof Repository>["getConversation"]>>>;
  const output = presenter(data).runs[0].executionLog;
  assert.deepEqual(output.slice(0, 3), logs.slice(0, 3));
  assert.deepEqual(output[3], { action: "Malformed" });
});
