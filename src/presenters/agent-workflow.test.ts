import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { presentExecutionLog } from "./playground.presenter";
import { NODE_HEIGHT, NODE_WIDTH, deriveRunState, workflowEdges, workflowNodes } from "./agent-workflow.presenter";
import { layoutWorkflow } from "@/src/app/admin/agent/workflow/workflow-layout";
import { WorkflowWorkspace } from "@/src/app/admin/agent/workflow/workflow-workspace";
import type { BotRunReviewItem } from "@/lib/bot-run-review";

Object.assign(globalThis, { React });

const item: BotRunReviewItem = {
  id: "saved-run", createdAt: "2026-10-31T05:00:00Z", status: "success", intent: "ASK_BU_INFO",
  errorCode: null, latencyMs: 0, lineUserId: "synthetic", tokensUsed: 0,
  usedOpenAI: true, usedStudyMemory: false, usedTicketFlow: false, usedWebSearch: false,
  userMessage: { content: "<script>question</script>", createdAt: "2026-10-31T05:00:00Z" },
  assistantMessage: { content: "answer", createdAt: "2026-10-31T05:00:00Z", sourceUrls: ["javascript:fixture", "https://bu.ac.th/"] },
  metadata: { channel: "web", needsWebSearch: false, routerConfidence: 1, routerReason: null,
    routerType: "agent_router", selectedTarget: "knowledge_base", executionLog: [
      { action: "Reranker", durationMs: 0, status: "fallback", rag: { tokens: 0, chunks: [{
        id: "chunk", title: "Wi-Fi", sourceUrl: "javascript:fixture", content: "<script>evidence</script>",
        rank: 8, selectedRank: 1, rrfScore: 0.02, similarity: null
      }] } },
      { action: "RRF Fusion", durationMs: 999999, status: "applied" }
    ] }
};

test("shared execution projection rejects malformed data while preserving order, legacy and zero values", () => {
  assert.deepEqual(presentExecutionLog({ action: "wrong shape" }), []);
  assert.deepEqual(presentExecutionLog([null, [], "bad", { action: 42 },
    { action: "legacy", durationMs: -1, status: "healthy", rag: { tokens: -1 } },
    { action: "zero", durationMs: 0, status: "skipped", rag: { tokens: 0 } },
    { action: "invalid timing", durationMs: Infinity }]), [
    { action: "legacy" }, { action: "zero", durationMs: 0, status: "skipped", rag: { tokens: 0 } },
    { action: "invalid timing" }
  ]);
});

test("workflow renders saved evidence safely, preserves scoped Trace links, and never adds RRF duration", () => {
  const html = renderToStaticMarkup(React.createElement(WorkflowWorkspace, {
    items: [item], totalCount: 25, page: 2, initialRunId: item.id,
    filters: { from: "2026-10-25", to: "2026-10-31", channel: "web", target: "knowledge_base", status: "success", usedWebSearch: "false" }
  }));
  for (const text of ["0 ms", "0 tokens", "fallback", "Selected #1", "&lt;script&gt;evidence&lt;/script&gt;", "view=trace", "page=2", "run=saved-run", "channel=web", "target=knowledge_base", "usedWebSearch=false"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("999,999 ms"));
  assert.ok(!html.includes("Healthy"));
});

const step = (action: string, status?: "applied" | "fallback" | "error" | "skipped") => ({ action, durationMs: 7, ...(status ? { status } : {}) });
const base = { runStatus: "success", hasAnswer: true };

test("graph edges and nodes come only from the declared source topology", () => {
  const ids = new Set(workflowNodes.map((node) => node.id));
  assert.equal(ids.size, workflowNodes.length);
  for (const edge of workflowEdges) assert.ok(ids.has(edge.from) && ids.has(edge.to), edge.id);
  assert.deepEqual(workflowNodes.flatMap((node) => node.targets ?? []).sort(), ["general_chat", "out_of_scope", "study_memory", "ticket", "unknown"]);
});

test("run state lights only the recorded path and marks gaps as not recorded", () => {
  const run = deriveRunState({ ...base, target: "web_search", routerType: "agent_router",
    steps: [step("Agent Router Decision", "applied"), step("Search Fresh Info (Web Search)", "applied")] });
  assert.equal(run.nodes.agent_router.state, "success");
  assert.equal(run.nodes.web_search.state, "success");
  assert.equal(run.nodes.bulinks_lookup.state, "unrecorded");
  assert.equal(run.nodes.query_rewrite.state, "idle");
  assert.equal(run.nodes.study_memory.state, "idle");
  assert.equal(run.nodes.output.state, "unknown");
  assert.deepEqual(Object.keys(run.edges).filter((id) => run.edges[id]).sort(),
    ["bulinks-web", "router-bulinks", "user-router", "web-output"]);
});

test("knowledge miss records fallback to fresh information and skipped generation", () => {
  const run = deriveRunState({ ...base, target: "knowledge_base", routerType: "agent_router", steps: [
    step("Agent Router Decision", "applied"), step("Query Rewrite", "applied"), step("Hybrid Retrieval", "applied"), step("RRF Fusion", "skipped"),
    step("Reranker", "fallback"), step("LLM Generation", "skipped"), step("BU Links Lookup", "applied"), step("Output", "applied")] });
  assert.equal(run.nodes.reranker.state, "fallback");
  assert.equal(run.nodes.rrf_fusion.durationMs, undefined);
  assert.equal(run.nodes.llm_generation.state, "skipped");
  assert.ok(run.edges["llm-bulinks"] && run.edges["bulinks-output"] && !run.edges["llm-output"] && !run.edges["bulinks-web"]);
});

test("hard guard routes are read from routerType and legacy or empty runs never invent state", () => {
  const guard = deriveRunState({ ...base, target: "study_memory", routerType: "hard_guard", steps: [step("Agent Router Decision", "applied"), step("Search Study Memory")] });
  assert.equal(guard.nodes.agent_router.state, "success");
  assert.match(guard.nodes.agent_router.note ?? "", /hard guard/);
  assert.equal(guard.nodes.study_memory.state, "success");
  assert.ok(guard.edges["router-study"] && !guard.edges["router-ticket"]);
  const legacy = deriveRunState({ ...base, target: null, routerType: null, steps: [] });
  assert.equal(legacy.nodes.agent_router.state, "unrecorded");
  assert.equal(legacy.nodes.general_chat.state, "unrecorded");
  assert.ok(Object.values(legacy.edges).every((on) => !on));
  const failed = deriveRunState({ runStatus: "error", errorCode: "Error", hasAnswer: false, target: "ticket", routerType: "agent_router", steps: [] });
  assert.equal(failed.nodes.ticket.state, "unknown");
  assert.equal(failed.nodes.output.state, "unrecorded");
  assert.ok(Object.values(deriveRunState(null).nodes).every((node) => node.state === "idle"));
});

test("ELK layout places every node without overlap and routes every edge", async () => {
  const layout = await layoutWorkflow();
  const boxes = workflowNodes.map((node) => ({ id: node.id, ...layout.positions[node.id] }));
  for (const [index, first] of boxes.entries()) for (const second of boxes.slice(index + 1)) {
    const apart = first.x + NODE_WIDTH <= second.x || second.x + NODE_WIDTH <= first.x || first.y + NODE_HEIGHT <= second.y || second.y + NODE_HEIGHT <= first.y;
    assert.ok(apart, `${first.id} overlaps ${second.id}`);
  }
  for (const edge of workflowEdges) assert.ok((layout.routes[edge.id]?.points.length ?? 0) >= 2, edge.id);
});

test("legacy, missing selection, empty and error states do not invent steps or silently switch runs", () => {
  const render = (props: Partial<React.ComponentProps<typeof WorkflowWorkspace>>) => renderToStaticMarkup(
    React.createElement(WorkflowWorkspace, { items: [], totalCount: 0, page: 1, filters: {}, ...props }));
  assert.ok(render({}).includes("ไม่มี Bot Runs"));
  assert.ok(render({ error: "Storage unavailable" }).includes('role="alert"'));
  assert.ok(render({ items: [item], initialRunId: "not-on-page" }).includes("ไม่พบ run ที่เลือก"));
  assert.ok(!render({ items: [item], initialRunId: "not-on-page" }).includes("Selected #1"));
  const legacy = render({ items: [{ ...item, metadata: { ...item.metadata, executionLog: [{ action: "Legacy step" }] } }] });
  assert.ok(legacy.includes("ไม่ได้บันทึกสถานะ"));
  assert.ok(legacy.includes("ไม่ได้บันทึกเวลาของขั้นตอนนี้"));
});
