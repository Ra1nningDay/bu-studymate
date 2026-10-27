import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { consumeChatSseResponse, SseStreamError } from "@/lib/chat-sse-client";
import { extractJsonAnswerPrefix } from "@/lib/openai-stream";
import type { ChatLogRepository, CreateBotRunData, CreateChatMessageData, UpdateBotRunData } from "@/src/repositories/chat-log.repository";
import type { KnowledgeEvidence } from "@/src/repositories/knowledge.repository";
import type { KnowledgeService } from "@/src/services/knowledge.service";
import type { PlaygroundService } from "@/src/services/playground.service";
import type { RateLimitService } from "@/src/services/rate-limit.service";
import type { StudyMemoryService } from "@/src/services/study-memory.service";
import type { TicketService } from "@/src/services/ticket.service";
import { standardAdminFixture } from "@/src/services/test-support/admin-auth-fixture";

let env: typeof import("@/src/config/env").env;
let ChatOrchestrationService: typeof import("@/src/services/chat-orchestration.service").ChatOrchestrationService;
let PlaygroundController: typeof import("@/src/controllers/playground.controller").PlaygroundController;
let ChatController: typeof import("@/src/controllers/chat.controller").ChatController;
let rewriteKnowledgeAnswer: typeof import("@/lib/ai").rewriteKnowledgeAnswer;
let createWebSearchResponse: typeof import("@/lib/ai").createWebSearchResponse;
const originalFetch = globalThis.fetch;

const sessionId = "playground-12345678-1234-4123-8123-123456789abc";
const origin = "http://localhost:3025";

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(frame));
        }
        controller.close();
      }
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    }
  );
}

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  env.AGENT_ROUTER_MODE = "openai";
  ({ ChatOrchestrationService } = await import("@/src/services/chat-orchestration.service"));
  ({ PlaygroundController } = await import("@/src/controllers/playground.controller"));
  ({ ChatController } = await import("@/src/controllers/chat.controller"));
  ({ rewriteKnowledgeAnswer, createWebSearchResponse } = await import("@/lib/ai"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.OPENAI_API_KEY = "synthetic-key";
  env.AGENT_ROUTER_MODE = "openai";
});

test("extractJsonAnswerPrefix decodes incremental Thai/Unicode escapes and holds incomplete escape sequences", () => {
  assert.equal(extractJsonAnswerPrefix("{"), null);
  assert.equal(extractJsonAnswerPrefix('{"answer": "สวัสดี'), "สวัสดี");
  assert.equal(extractJsonAnswerPrefix('{"answer": "บรรทัด1\\nบรรทัด2'), "บรรทัด1\nบรรทัด2");
  assert.equal(extractJsonAnswerPrefix('{"answer": "รอ escape\\'), "รอ escape");
  assert.equal(extractJsonAnswerPrefix('{"answer": "รอ unicode\\u0E0'), "รอ unicode");
  assert.equal(extractJsonAnswerPrefix('{"answer": "รอ unicode\\u0E01'), "รอ unicodeก");
  assert.equal(
    extractJsonAnswerPrefix('{"evidenceIds":["id-1"],"answer":"สลับลำดับคีย์ได้"}'),
    "สลับลำดับคีย์ได้"
  );
});

test("createBotReply runs session+history, pre-execution writes, and post-execution writes concurrently", async () => {
  let activePhase1 = 0;
  let maxConcurrentPhase1 = 0;
  let activePhase2 = 0;
  let maxConcurrentPhase2 = 0;
  let activePhase3 = 0;
  let maxConcurrentPhase3 = 0;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/responses")) {
      return Response.json({
        output_text: JSON.stringify({
          intent: "ASK_BU_INFO",
          selectedTarget: "knowledge_base",
          confidence: 0.99,
          needsWebSearch: false,
          reason: "test",
          safetyCritical: false
        })
      });
    }
    throw new Error("Unexpected fetch");
  };

  let createdUserMsgId: string | undefined;
  let excludedIdInHistory: string | undefined;

  const repo = {
    getRecentCompletedChatHistory: async () => {
      activePhase1 += 1;
      maxConcurrentPhase1 = Math.max(maxConcurrentPhase1, activePhase1);
      await delay(25);
      activePhase1 -= 1;
      return [];
    },
    getRecentChatHistory: async (_userId: string, limit?: number, excludeId?: string) => {
      assert.equal(limit, 8);
      excludedIdInHistory = excludeId;
      activePhase2 += 1;
      maxConcurrentPhase2 = Math.max(maxConcurrentPhase2, activePhase2);
      await delay(25);
      activePhase2 -= 1;
      return [];
    },
    createChatMessage: async (data: CreateChatMessageData) => {
      if (data.role === "user") {
        createdUserMsgId = data.id;
        activePhase2 += 1;
        maxConcurrentPhase2 = Math.max(maxConcurrentPhase2, activePhase2);
        await delay(25);
        activePhase2 -= 1;
      } else {
        activePhase3 += 1;
        maxConcurrentPhase3 = Math.max(maxConcurrentPhase3, activePhase3);
        await delay(25);
        activePhase3 -= 1;
      }
      return { id: data.id ?? "msg" };
    },
    createBotRun: async (data: CreateBotRunData) => {
      assert.equal(data.userMessageId, createdUserMsgId ?? data.userMessageId);
      activePhase2 += 1;
      maxConcurrentPhase2 = Math.max(maxConcurrentPhase2, activePhase2);
      await delay(25);
      activePhase2 -= 1;
      return { id: "parallel-run-1" };
    },
    updateBotRun: async (id: string, data: UpdateBotRunData) => { assert.ok(data.assistantMessageId);
      activePhase3 += 1;
      maxConcurrentPhase3 = Math.max(maxConcurrentPhase3, activePhase3);
      await delay(25);
      activePhase3 -= 1;
      return { id };
    }
  } as unknown as ChatLogRepository;

  const tickets = {
    getOrCreateChatSession: async () => {
      activePhase1 += 1;
      maxConcurrentPhase1 = Math.max(maxConcurrentPhase1, activePhase1);
      await delay(25);
      activePhase1 -= 1;
      return {
        id: "session-1",
        line_user_id: "user-1",
        state: "IDLE" as const,
        draft_data: {},
        created_at: "2026-10-27T00:00:00Z",
        updated_at: "2026-10-27T00:00:00Z"
      };
    }
  } as unknown as TicketService;

  const knowledge = {
    answerQuestion: async () => ({
      text: "คำตอบจากฐานความรู้",
      sources: [{ title: "FAQ", url: "https://faq.bu.ac.th/item" }],
      isMiss: false
    })
  } as unknown as KnowledgeService;

  const service = new ChatOrchestrationService(repo, tickets, {} as StudyMemoryService, knowledge);
  const reply = await service.createBotReply({ channel: "web", lineUserId: "user-1", message: "BU Wi-Fi ใช้ยังไง" });

  assert.equal(reply.runId, "parallel-run-1");
  assert.equal(maxConcurrentPhase1, 2, "session and completedHistory must run concurrently");
  assert.equal(maxConcurrentPhase2, 3, "raw history, createChatMessage(user), and createBotRun must run concurrently");
  assert.equal(maxConcurrentPhase3, 2, "createChatMessage(assistant) and updateBotRun must run concurrently");
  assert.ok(createdUserMsgId && createdUserMsgId === excludedIdInHistory);
});

test("rewriteKnowledgeAnswer streams progressive deltas, suppresses NO_VERIFIED_INFO_FOUND, and resets on missing citations", async () => {
  const evidence: KnowledgeEvidence[] = [{
    id: "ev-1",
    documentId: "doc-1",
    title: "BU Wi-Fi",
    category: "IT",
    content: "ต่อผ่านเครือข่าย BU-WiFi",
    keywords: [],
    source: "https://faq.bu.ac.th/wifi",
    sourceUrl: "https://faq.bu.ac.th/wifi",
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    verifiedAt: new Date("2026-10-27T00:00:00Z"),
    validFrom: null,
    validUntil: null,
    score: 0.03,
    similarity: 0.9
  }];

  globalThis.fetch = async () =>
    sseResponse([
      `data: ${JSON.stringify({ model: "gpt-6-luna", choices: [{ delta: { content: '{"answer":"ขั้นที่ 1 ' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'เชื่อมต่อ BU-WiFi",' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '"evidenceIds":["ev-1"]}' }, finish_reason: "stop" }], usage: { total_tokens: 42 } })}\n\n`,
      "data: [DONE]\n\n"
    ]);

  const deltas: string[] = [];
  let resets = 0;
  const hit = await rewriteKnowledgeAnswer({
    evidence,
    question: "Wi-Fi",
    onTextDelta: (d) => deltas.push(d),
    onTextReset: () => { resets += 1; }
  });
  assert.deepEqual(deltas, ["ขั้นที่ 1 ", "เชื่อมต่อ BU-WiFi"]);
  assert.equal(resets, 0);
  assert.equal(hit.text, "ขั้นที่ 1 เชื่อมต่อ BU-WiFi");
  assert.equal(hit.usage?.total_tokens, 42);

  // Miss sentinel should never emit partial deltas
  globalThis.fetch = async () =>
    sseResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"answer":"NO_VERIFIED_' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'INFO_FOUND","evidenceIds":[]}' }, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n"
    ]);
  const missDeltas: string[] = [];
  const miss = await rewriteKnowledgeAnswer({
    evidence,
    question: "Unknown",
    onTextDelta: (d) => missDeltas.push(d)
  });
  assert.deepEqual(missDeltas, []);
  assert.equal(miss.text, "NO_VERIFIED_INFO_FOUND");

  // Uncited answer after streaming partial deltas triggers onTextReset
  globalThis.fetch = async () =>
    sseResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"answer":"คำตอบที่ไม่ได้อ้างอิง",' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '"evidenceIds":[]}' }, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n"
    ]);
  let uncitedResets = 0;
  const uncited = await rewriteKnowledgeAnswer({
    evidence,
    question: "Uncited",
    onTextDelta: () => {},
    onTextReset: () => { uncitedResets += 1; }
  });
  assert.equal(uncitedResets, 1);
  assert.equal(uncited.text, "NO_VERIFIED_INFO_FOUND");
});

test("createWebSearchResponse streams Responses API deltas while trimming trailing source section", async () => {
  globalThis.fetch = async () =>
    sseResponse([
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "มหาวิทยาลัยเปิดทำการปกติ" })}\n\n`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "\n\nแหล่งที่มา:\nhttps://bu.ac.th/news" })}\n\n`,
      `data: ${JSON.stringify({
        type: "response.completed",
        response: {
          model: "gpt-6-luna",
          output_text: "มหาวิทยาลัยเปิดทำการปกติ\n\nแหล่งที่มา:\nhttps://bu.ac.th/news",
          usage: { total_tokens: 55 }
        }
      })}\n\n`,
      "data: [DONE]\n\n"
    ]);

  const deltas: string[] = [];
  const res = await createWebSearchResponse({
    message: "วันนี้เปิดไหม",
    toolType: "web_search_preview",
    onTextDelta: (d) => deltas.push(d)
  });
  assert.deepEqual(deltas, ["มหาวิทยาลัยเปิดทำการปกติ"]);
  assert.equal(res?.text, "มหาวิทยาลัยเปิดทำการปกติ");
  assert.deepEqual(res?.sources, [{ title: "https://bu.ac.th/news", url: "https://bu.ac.th/news" }]);
});

test("PlaygroundController and ChatController stream SSE events with Accept: text/event-stream and keep JSON errors safe", async () => {
  const { service: auth, adminToken } = await standardAdminFixture();
  const limiter = { consume: async () => ({ allowed: true }) } as unknown as RateLimitService;

  const chat = {
    createBotReply: async (input: Parameters<InstanceType<typeof ChatOrchestrationService>["createBotReply"]>[0]) => {
      input.stream?.onTextDelta?.("สวัสดี");
      input.stream?.onTextDelta?.("ครับ");
      input.stream?.onTextReplace?.("สวัสดีครับ\n\nแหล่งข้อมูล:\n- https://faq.bu.ac.th/1", [
        { title: "FAQ", url: "https://faq.bu.ac.th/1" }
      ]);
      return {
        runId: "sse-run-1",
        text: "สวัสดีครับ\n\nแหล่งข้อมูล:\n- https://faq.bu.ac.th/1",
        sources: [{ title: "FAQ", url: "https://faq.bu.ac.th/1" }]
      };
    }
  } as unknown as InstanceType<typeof ChatOrchestrationService>;

  const playground = new PlaygroundController(auth, {} as PlaygroundService, chat, limiter);
  const sseReq = new Request(`${origin}/api/admin/playground/message`, {
    method: "POST",
    headers: {
      origin,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      cookie: `studymate-admin=${adminToken}`
    },
    body: JSON.stringify({ sessionId, message: "สวัสดี" })
  });

  const response = await playground.send(sseReq);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);

  const deltas: string[] = [];
  let replacedText = "";
  const done = await consumeChatSseResponse<{ runId: string; reply: string; sources: string[] }>(response, {
    onDelta: (d) => deltas.push(d),
    onReplace: (text) => { replacedText = text; }
  });

  assert.deepEqual(deltas, ["สวัสดี", "ครับ"]);
  assert.match(replacedText, /faq\.bu\.ac\.th/);
  assert.equal(done.runId, "sse-run-1");
  assert.deepEqual(done.sources, ["https://faq.bu.ac.th/1"]);

  // Web Chat controller SSE
  const webChat = new ChatController(chat, limiter, undefined, auth, {} as TicketService);
  const webResp = await webChat.handleWebChat(new Request(`${origin}/api/chat`, {
    method: "POST",
    headers: {
      origin,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      cookie: `studymate-admin=${adminToken}`
    },
    body: JSON.stringify({ sessionId: "browser-1", message: "สวัสดี" })
  }));
  const webDone = await consumeChatSseResponse<{ reply: string; runId: string }>(webResp, {});
  assert.equal(webDone.runId, "sse-run-1");
  assert.match(webDone.reply, /สวัสดีครับ/);

  // Error inside SSE stream hides internal credentials
  const failingChat = {
    createBotReply: async () => {
      throw new Error("postgresql://secret-password@db.internal");
    }
  } as unknown as InstanceType<typeof ChatOrchestrationService>;
  const failingPlayground = new PlaygroundController(auth, {} as PlaygroundService, failingChat, limiter);
  const errResp = await failingPlayground.send(new Request(`${origin}/api/admin/playground/message`, {
    method: "POST",
    headers: {
      origin,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      cookie: `studymate-admin=${adminToken}`
    },
    body: JSON.stringify({ sessionId, message: "สวัสดี" })
  }));
  await assert.rejects(
    () => consumeChatSseResponse(errResp, {}),
    (err: unknown) => err instanceof SseStreamError && !err.message.includes("secret-password")
  );
});
