import test from "node:test";
import assert from "node:assert/strict";
import { calculateAiCost, calculateSearchCost } from "./pricing.config";

test("Luna uses its own input, cached input and output rates", () => {
  const result = calculateAiCost("gpt-6-luna", { promptTokens: 1_000_000, cachedTokens: 200_000, completionTokens: 100_000, totalTokens: 1_100_000 });
  assert.ok(result);
  assert.ok(Math.abs(result.costUsd - 0.132) < 1e-12);
});

test("web-search pricing distinguishes observed counts, tool versions and unknown counts", () => {
  assert.equal(calculateSearchCost("gpt-6-luna", "web_search_preview", 2), 0.02);
  assert.equal(calculateSearchCost("gpt-4o", "web_search_preview", 2), 0.05);
  assert.equal(calculateSearchCost("gpt-4o", "web_search", 2), 0.02);
  assert.equal(calculateSearchCost("gpt-6-luna", "web_search_preview", null), null);
  assert.equal(calculateSearchCost("gpt-6-luna", "web_search_preview", 0), 0);
});

test("Jev dated build bills input only", () => {
  const result = calculateAiCost("typesafe/jev-1.13-20260917", { promptTokens: 1_000_000, completionTokens: 200, totalTokens: 1_000_200 });
  assert.equal(result?.costUsd, 0.042);
});

test("unknown models and incomplete or inconsistent usage never acquire a fallback price", () => {
  for (const name of ["unknown", "not-gpt-4o-mini", "gpt-6-luna-rerank", "gpt-6-luna"]) {
    const usage = name === "gpt-6-luna" ? { totalTokens: 100 } : { promptTokens: 80, completionTokens: 20, totalTokens: 100 };
    assert.equal(calculateAiCost(name, usage), null);
  }
  for (const usage of [
    { promptTokens: 80, completionTokens: 20, cachedTokens: 81, totalTokens: 100 },
    { promptTokens: 80, completionTokens: 20, totalTokens: 101 },
    { promptTokens: -1, completionTokens: 20 },
    { promptTokens: NaN, completionTokens: 20 }
  ]) assert.equal(calculateAiCost("gpt-6-luna", usage), null);
});
