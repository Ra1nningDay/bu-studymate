import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { createConciseChatFixture } from "@/evals/concise-chat/fixtures";
import type { KnowledgeService } from "@/src/services/knowledge.service";
import type { StudyMemoryService, SavedStudyNote } from "@/src/services/study-memory.service";
import type { TicketService } from "@/src/services/ticket.service";

let env: typeof import("@/src/config/env").env;
const originalFetch = globalThis.fetch;
before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@127.0.0.1:1/fixture_unused";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  env.AGENT_ROUTER_MODE = "openai";
});
afterEach(() => { globalThis.fetch = originalFetch; });

for (const channel of ["web", "line"] as const) {
  for (const [message, expectedIntent, expectedText, expectedCalls] of [
    ["/addnote", "ADD_STUDY_NOTE", "Please use this format:\n/addnote <Course Name>\n<Note content>", []],
    ["/addnote Math\nFractions", "ADD_STUDY_NOTE", "Your study pack is ready.", ["save:Math:Fractions"]],
    ["งานที่ต้องส่งมีอะไรบ้าง", "LIST_ASSIGNMENTS", "ยังไม่พบ assignment ในโน้ตที่บันทึกไว้ครับ", ["find-course", "assignments"]],
    ["ดูบันทึกโน้ต", "LIST_NOTEBOOKS", "Saved notebooks", ["notebooks"]],
    ["BU-TICKET-0001", "CHECK_TICKET_STATUS", "ยังไม่พบ Ticket: BU-TICKET-0001 ครับ", ["ticket:BU-TICKET-0001"]],
    ["cancel", "GENERAL_CHAT", "Conversation reset. How can I help you?", ["reset"]],
    ["ถามข้อมูลทั่วไป", "GENERAL_CHAT", "อยากรู้เรื่องไหนเกี่ยวกับ BU พิมพ์ถามได้เลยครับ 😊", []]
  ] as const) {
    test(`${channel}: branch ${message} preserves dispatch, output and saved reply`, async () => {
      globalThis.fetch = async () => { throw new Error("Hard guards must skip provider calls"); };
      const calls: string[] = [];
      const note: SavedStudyNote = { courseName: "Math", summary: null, keyPoints: [], assignments: [], materialId: "note", sourceType: "text", title: null };
      const study = {
        saveStudyNote: async (_id: string, course: string, text: string) => { calls.push(`save:${course}:${text}`); return note; },
        findCourseNameInMessage: async () => { calls.push("find-course"); return undefined; },
        getAssignments: async () => { calls.push("assignments"); return []; },
        listNotebooks: async () => { calls.push("notebooks"); return { text: "Saved notebooks" }; }
      } as unknown as StudyMemoryService;
      const tickets = {
        getOrCreateChatSession: async () => ({ id: "session", state: "IDLE" }),
        resetTicketFlow: async () => { calls.push("reset"); },
        getTicketByCode: async (code: string) => { calls.push(`ticket:${code}`); return null; }
      } as unknown as TicketService;
      const fixture = await createConciseChatFixture({ studyService: study, ticketService: tickets });
      let delivered = "";
      const reply = await fixture.service.createBotReply({ channel, lineUserId: "synthetic-eval-user", message, stream: { onTextDelta: text => { delivered += text; } } });
      assert.deepEqual(calls, expectedCalls);
      assert.equal(fixture.runs[0].intent, expectedIntent);
      assert.ok(reply.text.startsWith(expectedText));
      assert.equal(delivered, reply.text);
      assert.equal(fixture.messages[1].content, reply.text);
      assert.deepEqual(fixture.historyRequests, []);
      assert.equal(reply.executionLog?.at(-1)?.action, "Output");
      if (message.startsWith("/addnote Math")) assert.ok(reply.flexMessage);
      if (expectedIntent === "LIST_ASSIGNMENTS") assert.equal(reply.flexMessage, null);
      if (message === "ถามข้อมูลทั่วไป") {
        assert.ok(reply.quickReply);
        assert.equal(reply.quickReply.items.length, 6);
        assert.match(reply.text, /https:\/\/bulinks\.bu\.ac\.th\//);
        assert.match(reply.text, /https:\/\/faq\.bu\.ac\.th\//);
      }
    });
  }
}

test("knowledge miss keeps each provider's usage once across search fallback", async () => {
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.tools) return Response.json({ model: "search-model", output_text: "Fresh answer", usage: { total_tokens: 7, input_tokens: 5, output_tokens: 2 } });
    return Response.json({ model: "router-model", usage: { total_tokens: 3 }, output_text: JSON.stringify({ intent: "ASK_BU_INFO", selectedTarget: "knowledge_base", confidence: 0.99, needsWebSearch: false, reason: "fixture", safetyCritical: false }) });
  };
  const knowledge = { answerQuestion: async () => ({
    text: "miss", isMiss: true, usage: { total_tokens: 5 },
    trace: [{ action: "LLM Generation", status: "fallback" }],
    usageEntries: [{ provider: "openai", model: "rag-model", step: "answer", usage: { total_tokens: 5, prompt_tokens: 4, completion_tokens: 1 } }]
  }) } as unknown as KnowledgeService;
  const fixture = await createConciseChatFixture({ knowledgeService: knowledge });
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "Where is the office?" });
  assert.equal(reply.text, "Fresh answer");
  assert.deepEqual(fixture.tokenLogs.map(log => [log.model, log.totalTokens]), [["router-model", 3], ["rag-model", 5], ["search-model", 7]]);
  assert.equal((fixture.updates[0].metadata as Record<string, unknown>).tokensUsed, 15);
  assert.equal(reply.usage?.total_tokens, 12);
  assert.ok(reply.executionLog?.some(step => step.action === "Knowledge Base Miss - Falling back to Web Search"));
});

test("workflow errors mark the existing run failed and preserve router usage", async () => {
  globalThis.fetch = async () => Response.json({ model: "router-model", usage: { total_tokens: 3 }, output_text: JSON.stringify({ intent: "ASK_BU_INFO", selectedTarget: "knowledge_base", confidence: 0.99, needsWebSearch: false, reason: "fixture", safetyCritical: false }) });
  const knowledge = { answerQuestion: async () => { throw new Error("Synthetic workflow failure"); } } as unknown as KnowledgeService;
  const fixture = await createConciseChatFixture({ knowledgeService: knowledge });
  await assert.rejects(fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "Where is the office?" }), /Synthetic workflow failure/);
  assert.equal(fixture.messages.length, 1);
  assert.equal(fixture.updates[0].status, "error");
  assert.equal(fixture.tokenLogs.length, 1);
  assert.equal(fixture.tokenLogs[0].step, "router");
});
