import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RunTrace } from "@/app/admin/chat/run-trace";
import type { PlaygroundConversation, PlaygroundRun } from "@/src/dtos/playground.dto";

// tsx uses classic JSX for this Next.js config.
Object.assign(globalThis, { React });

const run: PlaygroundRun = {
  id: "synthetic-run", userMessageId: "user", assistantMessageId: "assistant",
  createdAt: "2026-10-13T00:00:00Z", status: "success", intent: "ASK_BU_INFO",
  errorCode: null, latencyMs: 0, routerType: null, routerReason: null,
  routerConfidence: null, selectedTarget: "knowledge_base", sessionState: "IDLE",
  modelName: null, tokensUsed: 0, usedWebSearch: false, usedStudyMemory: false, usedTicketFlow: false,
  executionLog: [{ action: "Reranker", status: "fallback", durationMs: 0, rag: { tokens: 0, chunks: [{
    id: "chunk-eight", title: "Wi-Fi", sourceUrl: "javascript:fixture", content: "<script>fixture</script>",
    rank: 8, selectedRank: 1, rrfScore: 0.02, similarity: null
  }] } }]
};
const conversation: PlaygroundConversation = {
  sessionId: "synthetic", createdAt: run.createdAt, state: "IDLE", runs: [run],
  messages: [{ id: "assistant", role: "assistant", text: "Synthetic answer", createdAt: run.createdAt, sources: ["https://bu.ac.th/wifi"] }]
};

test("RAG report opens recorded chunks, preserves zero timing/usage and escapes text/URLs", () => {
  const html = renderToStaticMarkup(React.createElement(RunTrace, { run, conversation }));
  assert.ok(html.includes('open=""'));
  assert.ok(html.includes("&lt;script&gt;fixture&lt;/script&gt;"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("RRF #8"));
  assert.ok(html.includes("Selected #1"));
  assert.ok(html.includes("0 ms"));
  assert.ok(html.includes("fallback"));
});

test("interactive trace preserves Sources and legacy logs without fabricating telemetry", () => {
  const legacy = { ...run, executionLog: [{ action: "Legacy step", details: "Existing recorded action" }] };
  const html = renderToStaticMarkup(React.createElement(RunTrace, { run: legacy, conversation, interactive: true }));
  assert.ok(html.includes("Sources (1)"));
  assert.ok(html.includes("Existing recorded action"));
  assert.ok(!html.includes("Selected #"));
  assert.ok(!html.includes("RRF #"));
});
