import test from "node:test";
import assert from "node:assert/strict";
import { TokenUsageRepository } from "./token-usage.repository";

test("usage writer preserves exact provider cost, estimates known splits and leaves unknown costs null", async () => {
  const captured: Array<Record<string, unknown>> = [];
  const repo = new TokenUsageRepository({ aiTokenLog: {
    create: async ({ data }: { data: Record<string, unknown> }) => { captured.push(data); return data; },
    createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { captured.push(...data); return { count: data.length }; }
  } } as never);
  await repo.recordUsage({ provider: "openrouter", model: "typesafe/jev-1.13-20260917", step: "router", promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.0000042 });
  await repo.recordUsages([
    { provider: "openai", model: "gpt-6-luna", step: "answer", totalTokens: 100 },
    { provider: "openai", model: "unknown", step: "answer", promptTokens: 80, completionTokens: 20 },
    { provider: "openai", model: "gpt-6-luna", step: "web_search_preview", promptTokens: 80, completionTokens: 20, webSearchCalls: 2 },
    { provider: "openrouter", model: "unknown-free", step: "router", totalTokens: 50, costUsd: 0 }
  ]);
  assert.equal(captured[0].costUsd, 0.0000042);
  assert.equal(captured[0].costSource, "provider");
  assert.equal(captured[1].costUsd, null);
  assert.equal(captured[1].costSource, null);
  assert.equal(captured[2].costUsd, null);
  assert.ok(Math.abs(Number(captured[3].costUsd) - 0.020018) < 1e-12);
  assert.equal(captured[3].webSearchCalls, 2);
  assert.equal(captured[3].costSource, "estimate:2026-10-31");
  assert.equal(captured[4].costUsd, 0);
  assert.equal(captured[4].costSource, "provider");
});
