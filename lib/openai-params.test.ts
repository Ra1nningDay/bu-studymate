import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

// The default model (gpt-6-luna) rejects any non-default temperature with HTTP 400, and each caller
// swallows that error into a fallback, so the failure is silent in production. Pin that no request sends one.
let env: typeof import("@/src/config/env").env;
let generateStudyAnswer: typeof import("@/lib/study-answer").generateStudyAnswer;
let extractStudyNote: typeof import("@/lib/study-extract").extractStudyNote;
let extractTicketDraftFromLLM: typeof import("@/lib/ai").extractTicketDraftFromLLM;
const originalFetch = globalThis.fetch;
const originalProcessKey = process.env.OPENAI_API_KEY;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  process.env.OPENAI_API_KEY = "synthetic-key";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  ({ generateStudyAnswer } = await import("@/lib/study-answer"));
  ({ extractStudyNote } = await import("@/lib/study-extract"));
  ({ extractTicketDraftFromLLM } = await import("@/lib/ai"));
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalProcessKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalProcessKey;
});

function capture() {
  process.env.OPENAI_API_KEY = "synthetic-key"; // extractTicketDraftFromLLM reads process.env directly
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: "{\"summary\":\"s\",\"keyPoints\":[],\"assignments\":[],\"title\":null}" } }] });
  };
  return bodies;
}

test("study answer request sends no temperature", async () => {
  const bodies = capture();
  await generateStudyAnswer("คำถาม", "บริบท");
  assert.equal(bodies.length, 1);
  assert.equal("temperature" in bodies[0], false);
});

test("study note extraction request sends no temperature", async () => {
  const bodies = capture();
  await extractStudyNote("วิชา", "เนื้อหา");
  assert.equal(bodies.length, 1);
  assert.equal("temperature" in bodies[0], false);
});

test("ticket draft extraction request sends no temperature", async () => {
  const bodies = capture();
  await extractTicketDraftFromLLM("แอร์ห้อง A301 เสีย");
  assert.equal(bodies.length, 1);
  assert.equal("temperature" in bodies[0], false);
});
