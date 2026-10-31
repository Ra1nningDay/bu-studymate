import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { ChatOrchestrationService } from "./chat/chat-orchestration.service";
import type { RateLimitService } from "./rate-limit.service";
import type { TicketService } from "./ticket.service";
import type { AdminOverviewRepository } from "@/src/repositories/admin-overview.repository";
import type { saveStudyFile } from "@/src/lib/study/study-file";
import { standardAdminFixture } from "./test-support/admin-auth-fixture";
import { analyticsDateRange } from "@/lib/analytics-date-range";

let Chat: typeof import("@/src/controllers/chat.controller").ChatController;
let Ticket: typeof import("@/src/controllers/ticket.controller").TicketController;
let Overview: typeof import("./admin-overview.service").AdminOverviewService;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ ChatController: Chat } = await import("@/src/controllers/chat.controller"));
  ({ TicketController: Ticket } = await import("@/src/controllers/ticket.controller"));
  ({ AdminOverviewService: Overview } = await import("./admin-overview.service"));
});

async function fixture() {
  const { service: auth, adminToken: token, viewerToken } = await standardAdminFixture();
  const calls: unknown[] = [];
  const chat = { createBotReply: async (input: unknown) => { calls.push(input); return { text: "reply" }; } } as unknown as ChatOrchestrationService;
  const limits = { consume: async () => { calls.push("limit"); return { allowed: true }; } } as unknown as RateLimitService;
  const tickets = {
    getOrCreateChatSession: async (id: string) => { calls.push(`session:${id}`); return {}; },
    updateTicketStatus: async (id: string, status: string) => { calls.push({ id, status }); return {}; }
  } as unknown as TicketService;
  const save = (async (input: Parameters<typeof saveStudyFile>[0]) => {
    calls.push(`save:${input.lineUserId}`);
    return { fileName: "lesson.docx", sourceType: "docx", usedOcr: false, warnings: [], note: { courseName: "Math", summary: "Fixture", keyPoints: [], assignments: [], materialId: "fixture-material", sourceType: "docx", title: "Lesson" } };
  }) as typeof saveStudyFile;
  const chatController = new Chat(chat, limits, undefined, auth, tickets, save);
  const ticketController = new Ticket(tickets, auth);
  const headers = { origin: "http://localhost:3025", cookie: `studymate-admin=${token}` };
  const viewerHeaders = { origin: "http://localhost:3025", cookie: `studymate-admin=${viewerToken}` };
  return { auth, calls, chatController, ticketController, headers, viewerHeaders };
}

test("shared auth checks do not consume POST bodies and reject the old Playground cookie", async () => {
  const f = await fixture();
  const request = new Request("http://localhost:3025/api/chat", { method: "POST", headers: f.headers, body: JSON.stringify({ message: "hello" }) });
  assert.ok(await f.auth.authenticate(request));
  assert.deepEqual(await request.json(), { message: "hello" });
  assert.equal(await f.auth.authenticate(new Request(request.url, { headers: { cookie: f.headers.cookie.replace("studymate-admin", "studymate-playground") } })), null);
});

test("web chat, uploads and ticket mutations deny unauthenticated callers before any work", async () => {
  const f = await fixture();
  const request = () => new Request("http://localhost:3025/api/chat?password=test-admin", { method: "POST", headers: { "x-admin-password": "test-admin" }, body: "invalid" });
  assert.equal((await f.chatController.handleWebChat(request())).status, 401);
  assert.equal((await f.chatController.handleStudyUpload(request())).status, 401);
  assert.equal((await f.ticketController.handleUpdateStatus(request(), { params: { id: "id" } })).status, 401);
  assert.deepEqual(f.calls, []);
});

test("viewer can read but every write endpoint returns 403 before any work", async () => {
  const f = await fixture();
  const { PlaygroundController } = await import("@/src/controllers/playground.controller");
  const { KnowledgeAdminController } = await import("@/src/controllers/knowledge-admin.controller");
  const { StudentAdminController } = await import("@/src/controllers/student-admin.controller");
  // Touching any dependency means work happened, so these throw instead of recording.
  const untouchable = new Proxy({}, { get: () => { throw new Error("work was done for a viewer"); } }) as never;
  const playground = new PlaygroundController(f.auth, untouchable, untouchable, untouchable);
  const knowledge = new KnowledgeAdminController(untouchable, f.auth);
  const students = new StudentAdminController(untouchable, f.auth);
  const post = () => new Request("http://localhost:3025/api/x", { method: "POST", headers: f.viewerHeaders, body: "invalid" });
  const writes: [string, () => Promise<Response>][] = [
    ["chat send", () => f.chatController.handleWebChat(post())],
    ["chat upload", () => f.chatController.handleStudyUpload(post())],
    ["ticket status", () => f.ticketController.handleUpdateStatus(post(), { params: { id: "id" } })],
    ["playground send", () => playground.send(post())],
    ["knowledge save", () => knowledge.save(post())],
    ["knowledge bulk", () => knowledge.bulk(post())],
    ["knowledge source", () => knowledge.snapshot(post())],
    ["knowledge check", () => knowledge.check(post(), "11111111-1111-4111-8111-111111111111")],
    ["student delete", () => students.handleDelete(post())]
  ];
  for (const [name, call] of writes) assert.equal((await call()).status, 403, name);
  assert.deepEqual(f.calls, []);
});

test("all web mutation paths reject cross-origin requests even with a valid cookie", async () => {
  const f = await fixture();
  const request = () => new Request("http://localhost:3025/api/chat", { method: "POST", headers: { ...f.headers, origin: "https://other.example" }, body: "invalid" });
  assert.equal((await f.chatController.handleWebChat(request())).status, 403);
  assert.equal((await f.chatController.handleStudyUpload(request())).status, 403);
  assert.equal((await f.ticketController.handleUpdateStatus(request(), { params: { id: "id" } })).status, 403);
  assert.deepEqual(f.calls, []);
});

test("authenticated legacy chat API preserves reply and web identity normalization", async () => {
  const f = await fixture();
  const response = await f.chatController.handleWebChat(new Request("http://localhost:3025/api/chat", {
    method: "POST", headers: { ...f.headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: "hello", sessionId: "browser-test" })
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "reply");
  assert.deepEqual(f.calls, ["limit", { channel: "web", lineUserId: "web-chat-browser-test", message: "hello" }]);
});

test("first upload creates a resumable session before saving the lesson under that identity", async () => {
  const f = await fixture();
  const form = new FormData();
  form.set("sessionId", "playground-11111111-1111-4111-8111-111111111111");
  form.set("file", new File(["fixture"], "lesson.docx"));
  const response = await f.chatController.handleStudyUpload(new Request("http://localhost:3025/api/chat/upload", { method: "POST", headers: f.headers, body: form }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).fileName, "lesson.docx");
  assert.deepEqual(f.calls, ["limit", "session:web-chat-playground-11111111-1111-4111-8111-111111111111", "save:web-chat-playground-11111111-1111-4111-8111-111111111111"]);
});

test("ticket updates keep status validation and redirect without credentials", async () => {
  const f = await fixture();
  const response = await f.ticketController.handleUpdateStatus(new Request("http://localhost:3025/api/admin/tickets/id/status", {
    method: "POST", headers: f.headers, body: new URLSearchParams({ status: "RESOLVED", password: "ignored" })
  }), { params: Promise.resolve({ id: "id" }) });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3025/admin/tickets");
  assert.deepEqual(f.calls, [{ id: "id", status: "RESOLVED" }]);
  const invalid = await f.ticketController.handleUpdateStatus(new Request("http://localhost:3025/api/admin/tickets/id/status", {
    method: "POST", headers: f.headers, body: new URLSearchParams({ status: "INVALID" })
  }), { params: { id: "id" } });
  assert.equal(invalid.status, 400);
  assert.equal(f.calls.length, 1);
});

type RawOverview = Awaited<ReturnType<AdminOverviewRepository["read"]>>;
function rawOverview(): RawOverview {
  return {
    conversations: [{ count: 2 }], daily: [{ day: "2026-10-12", count: 2 }],
    statuses: [{ status: "success", _count: { id: 3 } }, { status: "error", _count: { id: 1 } }, { status: "processing", _count: { id: 2 } }],
    intents: [{ intent: "ASK_BU_INFO", _count: { id: 4 } }, { intent: null, _count: { id: 2 } }],
    latency: { _avg: { latencyMs: 0 } }, openTickets: 1, knowledgeItems: 12, studyMaterials: 5, chunks: 30, tickets: [], failures: []
  };
}

test("dashboard uses seven Bangkok calendar days across UTC midnight", () => {
  const now = new Date("2026-10-11T18:00:00Z");
  assert.equal(analyticsDateRange({}, now).start.toISOString(), "2026-10-05T17:00:00.000Z");
  assert.equal(analyticsDateRange({}, now).end.toISOString(), "2026-10-12T17:00:00.000Z");
});

test("dashboard distinguishes unique identities from turns and fills missing days with zero", async () => {
  const data = rawOverview();
  const queries: Date[] = [];
  const service = new Overview({ read: async (start, end) => { queries.push(start, end); return data; } });
  const result = await service.read(new Date("2026-10-12T05:00:00Z"));
  assert.equal(result.totalConversations, 2);
  assert.equal(result.totalRuns, 6);
  assert.equal(result.successRate, 50);
  assert.equal(result.averageLatencyMs, 0);
  assert.deepEqual(result.days.map((day) => day.count), [0, 0, 0, 0, 0, 0, 2]);
  assert.equal(result.days[0].day, "2026-10-06");
  assert.equal(queries[0].toISOString(), "2026-10-05T17:00:00.000Z");
});

test("dashboard empty state has unknown success/latency, not a made-up healthy rate", async () => {
  const data = { ...rawOverview(), conversations: [], daily: [], statuses: [], intents: [], latency: { _avg: { latencyMs: null } } };
  const result = await new Overview({ read: async () => data }).read();
  assert.equal(result.successRate, null);
  assert.equal(result.averageLatencyMs, null);
  assert.equal(result.totalConversations, 0);
  assert.deepEqual(result.topIntents, []);
  assert.equal(result.days.length, 7);
});

test("dashboard custom dates reach storage and control chart length", async () => {
  const range = analyticsDateRange({ from: "2026-10-12", to: "2026-10-12" });
  const service = new Overview({ read: async (start, end) => {
    assert.equal(start.toISOString(), "2026-10-11T17:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-12T17:00:00.000Z");
    return rawOverview();
  } });
  const result = await service.read(new Date(), range);
  assert.deepEqual(result.days, [{ day: "2026-10-12", count: 2 }]);
  await assert.rejects(service.read(new Date(), analyticsDateRange({ from: "invalid" })), /YYYY-MM-DD/);
});

test("top intents combine the remaining counts and retain the same total", async () => {
  const data = rawOverview();
  data.intents = Array.from({ length: 8 }, (_, index) => ({ intent: `intent-${index}`, _count: { id: index + 1 } }));
  data.statuses = [{ status: "success", _count: { id: 36 } }];
  const result = await new Overview({ read: async () => data }).read();
  assert.equal(result.topIntents.length, 6);
  assert.deepEqual(result.topIntents.at(-1), { name: "อื่น ๆ", count: 6 });
  assert.equal(result.topIntents.reduce((sum, item) => sum + item.count, 0), result.totalRuns);
});


test("corpus snapshot uses cached reader when available and falls back to repository", async () => {
  let cachedCalls = 0;
  let repoCalls = 0;
  const repo = {
    read: async () => rawOverview(),
    readCorpusCounts: async () => {
      repoCalls += 1;
      return { knowledgeItems: 10, studyMaterials: 2, chunks: 15 };
    }
  };
  const serviceWithCache = new Overview(
    { read: repo.read },
    async () => {
      cachedCalls += 1;
      return { knowledgeItems: 99, studyMaterials: 8, chunks: 40 };
    }
  );
  assert.deepEqual(await serviceWithCache.readCorpusSnapshot(), { knowledgeItems: 99, studyMaterials: 8, chunks: 40 });
  assert.equal(cachedCalls, 1);

  const serviceWithCustomRepo = new Overview(repo);
  assert.deepEqual(await serviceWithCustomRepo.readCorpusSnapshot(), { knowledgeItems: 10, studyMaterials: 2, chunks: 15 });
  assert.equal(repoCalls, 1);
});
