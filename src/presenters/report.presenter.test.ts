import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDurationSmart,
  formatUtcDateTime,
  presentConversationReport,
  getSampleEddiReportFixture
} from "./report.presenter";
import type { PlaygroundConversation } from "@/src/dtos/playground.dto";

test("formatDurationSmart formats sub-second as ms and larger values as seconds", () => {
  assert.equal(formatDurationSmart(0), "0.00 ms");
  assert.equal(formatDurationSmart(7.56), "7.56 ms");
  assert.equal(formatDurationSmart(3550), "3.55 s");
  assert.equal(formatDurationSmart(39090), "39.09 s");
});

test("formatUtcDateTime creates ISO-style UTC string with UTC suffix", () => {
  const result = formatUtcDateTime("2026-10-09T18:32:19.000Z");
  assert.equal(result, "2026-10-09 18:32:19 UTC");
});

test("getSampleEddiReportFixture returns all 11 turns with step breakdown", () => {
  const fixture = getSampleEddiReportFixture();
  assert.equal(fixture.sessionId, "sess-local-01-EDDI-ALL-mv1ayhvs1");
  assert.equal(fixture.turnsCount, 11);
  assert.equal(fixture.turns.length, 11);
  assert.equal(fixture.student, "student-local-01");
  assert.equal(fixture.knowledgeBase, "EDDI-ALL");
  assert.equal(fixture.tokens.formatted, "input 4,795, output 1,660");
  assert.equal(fixture.formattedTotalTime, "77.32 s");

  // Verify steps summary
  assert.ok(fixture.stepSummaries.length > 0);
  const genStep = fixture.stepSummaries.find((s) => s.step === "Response generation");
  assert.ok(genStep);
  assert.equal(genStep.turns, 11);
  assert.equal(genStep.shareFormatted, "51%");

  const intentStep = fixture.stepSummaries.find((s) => s.step === "Intent detection");
  assert.ok(intentStep);
  assert.equal(intentStep.turns, 11);
  assert.equal(intentStep.shareFormatted, "49%");

  // Verify turn 1
  const t1 = fixture.turns[0];
  assert.equal(t1.turnNumber, 1);
  assert.equal(t1.anchorId, "turn-1");
  assert.equal(t1.userMessage, "สวัสดี");
  assert.equal(t1.assistantMessage, "สวัสดีค่ะ ยินดีที่ได้คุยกันนะคะ 😊");
  assert.equal(t1.formattedDuration, "5.85 s");
  assert.equal(t1.intent.intent, "explain");
  assert.equal(t1.intent.learnerState, "normal");

  // Verify turn 3 (academic with strategy and guardrail)
  const t3 = fixture.turns[2];
  assert.equal(t3.turnNumber, 3);
  assert.equal(t3.userMessage, "ไก่กับไข่อะไรเกิดก่อนกัน");
  assert.ok(t3.detectedConcept);
  assert.equal(t3.detectedConcept.studentLevel, "beginner");
  assert.ok(t3.strategy);
  assert.equal(t3.teachingPolicy?.row, "TP04");
  assert.equal(t3.responsePlan?.mode, "teaching");
});

test("presentConversationReport transforms normal PlaygroundConversation cleanly", () => {
  const conv: PlaygroundConversation = {
    sessionId: "playground-12345678-1234-4123-8123-123456789abc",
    createdAt: "2026-10-12T10:00:00.000Z",
    state: "IDLE",
    messages: [
      { id: "msg-1", role: "user", text: "สวัสดีครับ", createdAt: "2026-10-12T10:00:00.000Z", sources: [] },
      { id: "msg-2", role: "assistant", text: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ", createdAt: "2026-10-12T10:00:02.000Z", sources: [] },
      { id: "msg-3", role: "user", text: "ห้องสมุดเปิดกี่โมง", createdAt: "2026-10-12T10:01:00.000Z", sources: [] },
      { id: "msg-4", role: "assistant", text: "ห้องสมุดเปิด 08:30 - 18:00 ครับ", createdAt: "2026-10-12T10:01:03.000Z", sources: ["https://bu.ac.th/library"] }
    ],
    runs: [
      {
        id: "run-1",
        userMessageId: "msg-1",
        assistantMessageId: "msg-2",
        createdAt: "2026-10-12T10:00:00.000Z",
        status: "success",
        intent: "GENERAL_CHAT",
        errorCode: null,
        latencyMs: 2500,
        routerType: "semantic",
        routerReason: "User greeting",
        routerConfidence: 0.99,
        selectedTarget: "general_chat",
        sessionState: "IDLE",
        modelName: "gpt-4o-mini",
        tokensUsed: 150,
        usedWebSearch: false,
        usedStudyMemory: false,
        usedTicketFlow: false,
        executionLog: [{ action: "Agent Router Classification" }, { action: "Generate General Chat Answer (OpenAI)" }]
      },
      {
        id: "run-2",
        userMessageId: "msg-3",
        assistantMessageId: "msg-4",
        createdAt: "2026-10-12T10:01:00.000Z",
        status: "success",
        intent: "ASK_BU_INFO",
        errorCode: null,
        latencyMs: 3100,
        routerType: "semantic",
        routerReason: "Library inquiry",
        routerConfidence: 0.97,
        selectedTarget: "knowledge_base",
        sessionState: "IDLE",
        modelName: "gpt-4o-mini",
        tokensUsed: 280,
        usedWebSearch: false,
        usedStudyMemory: false,
        usedTicketFlow: false,
        executionLog: [{ action: "Agent Router Classification" }, { action: "Search Knowledge Base" }, { action: "Generate General Chat Answer (OpenAI)" }]
      }
    ]
  };

  const report = presentConversationReport(conv);
  assert.equal(report.sessionId, conv.sessionId);
  assert.equal(report.turnsCount, 2);
  assert.equal(report.turns.length, 2);
  assert.equal(report.totalTimeSeconds, 5.6);
  assert.equal(report.formattedTotalTime, "5.60 s");
  assert.equal(report.tokens.total, 430);

  // Turn 1 assertions
  assert.equal(report.turns[0].userMessage, "สวัสดีครับ");
  assert.equal(report.turns[0].assistantMessage, "สวัสดีครับ มีอะไรให้ช่วยไหมครับ");
  assert.equal(report.turns[0].intent.intent, "GENERAL_CHAT");
  assert.equal(report.turns[0].intent.routerReason, "User greeting");

  // Turn 2 assertions
  assert.equal(report.turns[1].userMessage, "ห้องสมุดเปิดกี่โมง");
  assert.equal(report.turns[1].assistantMessage, "ห้องสมุดเปิด 08:30 - 18:00 ครับ");
  assert.deepEqual(report.turns[1].retrieval.sources, ["https://bu.ac.th/library"]);
  assert.equal(report.turns[1].retrieval.chunkCount, 1);

  // Step summaries
  assert.ok(report.stepSummaries.length > 0);
  assert.ok(report.stepSummaries.some((s) => s.step === "Intent detection"));
  assert.ok(report.stepSummaries.some((s) => s.step === "Response generation"));
});
