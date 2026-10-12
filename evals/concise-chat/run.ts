import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { conciseChatCases } from "./cases";
import { createConciseChatFixture } from "./fixtures";

loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
function argument(name: string) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

if (argument("--model")) process.env.OPENAI_MODEL = argument("--model");
if (argument("--router-model")) process.env.OPENAI_AGENT_ROUTER_MODEL = argument("--router-model");
// No database or external operational writes are used by the fixture services.
process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

type Observation = {
  caseId: string;
  repetition: number;
  channel: "line" | "web";
  message: string;
  expectedIntent: string;
  allowedIntents: string[];
  actualIntent?: string | null;
  selectedTarget?: unknown;
  safetyCritical?: unknown;
  answer: string;
  replyLength: number;
  ordinaryGeneratedGeneralChat: boolean;
  answerGenerationCalls: number;
  finishReasons: Array<string | null>;
  completionBounds: Array<number | null>;
  models: string[];
  questionMarkCount: number;
  rubric: string;
  humanReview: "pending";
  error?: string;
};

function metadataField(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  return Reflect.get(metadata, key);
}

async function main() {
  const { env } = await import("@/src/config/env");
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY unavailable; live verification remains incomplete.");
  const repetitions = Number(argument("--repetitions") ?? 3);
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("--repetitions must be a positive integer.");
  const outputDirectory = path.resolve(argument("--out") ?? ".promptfoo/concise-chat");
  await mkdir(outputDirectory, { recursive: true });
  const originalFetch = globalThis.fetch;
  const observations: Observation[] = [];

  try {
    for (const item of conciseChatCases) {
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const fixture = await createConciseChatFixture({ history: item.history, knowledgeMiss: item.knowledgeMiss });
        const finishReasons: Array<string | null> = [];
        const completionBounds: Array<number | null> = [];
        const models: string[] = [];
        let answerGenerationCalls = 0;
        let providerFailed = false;
        globalThis.fetch = async (input, init) => {
          const url = String(input);
          const body = JSON.parse(String(init?.body ?? "{}")) as { tools?: unknown[]; max_completion_tokens?: number };
          // Source-unavailable fixture exercises the real verified-information fallback without live search.
          if (body.tools?.length) return Response.json({ output_text: "VERIFIED_SOURCE_NOT_FOUND" });
          if (!url.startsWith("https://api.openai.com/") && !url.startsWith("https://openrouter.ai/")) {
            throw new Error("Unexpected network boundary in isolated concise-chat evaluation.");
          }
          const response = await originalFetch(input, {
            ...init,
            signal: AbortSignal.any([AbortSignal.timeout(45000), ...(init?.signal ? [init.signal] : [])])
          });
          if (!response.ok) providerFailed = true;
          if (url.endsWith("/chat/completions")) {
            answerGenerationCalls += 1;
            completionBounds.push(body.max_completion_tokens ?? null);
            const data = await response.clone().json() as { model?: string; choices?: Array<{ finish_reason?: string | null }> };
            if (data.model) models.push(data.model);
            finishReasons.push(...(data.choices ?? []).map((choice) => choice.finish_reason ?? null));
            if (!data.choices?.length) providerFailed = true;
            if (!response.ok) throw new Error(`Live answer-generation request failed: HTTP ${response.status}`);
          } else {
            const data = await response.clone().json() as { model?: string };
            if (data.model) models.push(data.model);
          }
          return response;
        };
        const channel = repetition % 2 === 0 ? "line" : "web";
        let answer = "";
        let error: string | undefined;
        try {
          answer = (await fixture.service.createBotReply({ channel, lineUserId: "synthetic-eval-user", message: item.message })).text;
        } catch {
          // Avoid printing provider bodies, credentials, or other raw error payloads.
          error = "Application or provider request failed; observation is not a successful live validation.";
        }
        const metadata = fixture.updates.at(-1)?.metadata;
        const actualIntent = fixture.runs.at(-1)?.intent;
        if (providerFailed || metadataField(metadata, "routerType") === "fallback") error = "Provider failure or unavailable routing; observation is not a successful live validation.";
        observations.push({
          caseId: item.id, repetition, channel, message: item.message,
          expectedIntent: item.expectedIntent, allowedIntents: item.allowedIntents ?? [item.expectedIntent], actualIntent,
          selectedTarget: metadataField(metadata, "selectedTarget"), safetyCritical: metadataField(metadata, "safetyCritical"),
          answer, replyLength: answer.length,
          ordinaryGeneratedGeneralChat: actualIntent === "GENERAL_CHAT" && answerGenerationCalls > 0 && !item.staticGuide && !item.safetyCritical,
          answerGenerationCalls, finishReasons, completionBounds, models,
          questionMarkCount: (answer.match(/\?/g) ?? []).length,
          rubric: item.rubric, humanReview: "pending", error
        });
        console.log(`${item.id} ${repetition}/${repetitions}: ${actualIntent ?? "unrecorded"}, ${answer.length} chars${error ? ", failed" : ""}`);
        // Keep partial observations reviewable if a later provider request fails or the run is interrupted.
        await writeFile(path.join(outputDirectory, "observations.json"), JSON.stringify(observations, null, 2));
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const ordinary = observations.filter((observation) => observation.ordinaryGeneratedGeneralChat && !observation.error);
  const withinTarget = ordinary.filter((observation) => observation.replyLength <= 300).length;
  const lengthCompliance = ordinary.length ? withinTarget / ordinary.length : 0;
  const routeFailures = observations.filter((observation) => !observation.allowedIntents.includes(observation.actualIntent ?? ""));
  const failures = observations.filter((observation) => observation.error);
  const cutoffs = observations.filter((observation) => observation.finishReasons.includes("length"));
  const boundaryCalls = observations.filter((observation) => (observation.expectedIntent === "OUT_OF_SCOPE" || observation.caseId === "static-upload-guide") && observation.answerGenerationCalls !== 0);
  const boundaryTextFailures = observations.filter((observation) => observation.expectedIntent === "OUT_OF_SCOPE" && observation.answer !== (conciseChatCases.find((item) => item.id === observation.caseId)?.language === "th"
    ? "เรื่องนี้อยู่นอกขอบเขตของ StudyMate ครับ ผมช่วยเรื่องข้อมูล BU บทเรียน และการแจ้งปัญหาภายในมหาวิทยาลัยได้"
    : "That is outside StudyMate's scope. I can help with BU information, study materials, and campus issue reports."));
  const safetyFailures = observations.filter((observation) => conciseChatCases.find((item) => item.id === observation.caseId)?.safetyCritical && observation.safetyCritical !== true);
  const emojiFailures = observations.filter((observation) =>
    ["GENERAL_CHAT", "UNKNOWN"].includes(observation.actualIntent ?? "") &&
    observation.answerGenerationCalls > 0 && observation.safetyCritical !== true &&
    /\p{Extended_Pictographic}/u.test(observation.answer));
  const automaticChecksPass = lengthCompliance >= 0.95 && routeFailures.length === 0 && failures.length === 0 && cutoffs.length === 0 && boundaryCalls.length === 0 && boundaryTextFailures.length === 0 && safetyFailures.length === 0 && emojiFailures.length === 0;
  const report = {
    evaluatedAt: new Date().toISOString(),
    configuredAnswerModel: env.OPENAI_MODEL,
    configuredRouterModel: env.OPENAI_AGENT_ROUTER_MODEL,
    configuredRouterMode: env.AGENT_ROUTER_MODE,
    repetitions,
    observations: observations.length,
    ordinaryGeneratedGeneralChat: ordinary.length,
    observedOrdinaryCompletionBounds: [...new Set(ordinary.flatMap((observation) => observation.completionBounds))],
    within300Characters: withinTarget,
    lengthCompliance,
    routingFailures: routeFailures.map((item) => `${item.caseId}:${item.repetition}`),
    failedObservations: failures.map((item) => `${item.caseId}:${item.repetition}`),
    tokenCutoffs: cutoffs.map((item) => `${item.caseId}:${item.repetition}`),
    forbiddenAnswerCalls: boundaryCalls.map((item) => `${item.caseId}:${item.repetition}`),
    boundaryTextFailures: boundaryTextFailures.map((item) => `${item.caseId}:${item.repetition}`),
    safetyRouteFailures: safetyFailures.map((item) => `${item.caseId}:${item.repetition}`),
    emojiPolicyFailures: emojiFailures.map((item) => `${item.caseId}:${item.repetition}`),
    automaticChecksPass,
    humanReview: "pending: sentence completeness, language, exactly one semantic missing detail for Unknown (not a compound question), progressive detail, safety and handoff honesty must be reviewed for every observation",
    limitation: "Synthetic fixture services validate conversational policy and route selection; they do not validate real retrieval, operational workflows or deployment."
  };
  await writeFile(path.join(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
  const markdown = [
    `# Concise chat live evaluation`,
    ``,
    `Answer model: ${env.OPENAI_MODEL}; router: ${env.AGENT_ROUTER_MODE}/${env.OPENAI_AGENT_ROUTER_MODEL}.`,
    `Ordinary completion bounds observed in actual generation requests: ${[...new Set(ordinary.flatMap((observation) => observation.completionBounds))].join(", ") || "none"}.`,
    ``,
    `${observations.length} observations; ${withinTarget}/${ordinary.length} ordinary generated General Chat replies ≤300 characters (${(lengthCompliance * 100).toFixed(1)}%; required ≥95%). Counting uses JavaScript .length, matching persisted replyLength.`,
    ``,
    `Automatic checks: ${automaticChecksPass ? "PASS" : "FAIL"}. Routing mismatches: ${routeFailures.length}; failed observations: ${failures.length}; token cutoffs: ${cutoffs.length}; forbidden generation calls: ${boundaryCalls.length}; boundary text mismatches: ${boundaryTextFailures.length}; safety route failures: ${safetyFailures.length}; pictographic emoji failures in ordinary generated General Chat/Unknown: ${emojiFailures.length}.`,
    ``,
    `Human review is pending. A stop finish_reason is not proof that the final sentence is complete. The question-mark count is a review aid, not a semantic question counter: a single '?' can still join two independently answerable questions.`,
    ``,
    `For every answer verify complete sentences, latest-message language (Thai ครับ / natural English), directness, 1–3 ordinary sentences, no repetition/emojis/stock closings, and the case rubric below. Unknown must ask for exactly one useful missing detail without an answer; asking both which item and what information is wanted is a compound clarification requiring semantic review. The automatic emoji gate matches Extended_Pictographic code points, without treating Thai combining characters as emoji; semantic review still checks other decorative or emoji forms. Progressive detail must give one short point and invite targeted continuation. Safety guidance must not be suppressed by length. Handoff must state transfer is unavailable and invent no contact.`,
    ``,
    `Fixture operational responses and source-unavailable web responses are deliberate controlled boundaries. This run does not establish production knowledge quality or deployment readiness.`,
    ...observations.flatMap((observation) => [
      ``, `## ${observation.caseId} / ${observation.repetition} (${observation.channel})`,
      ``, `Intent: ${observation.actualIntent}; allowed: ${observation.allowedIntents.join(", ")}; length: ${observation.replyLength}; finish_reason: ${observation.finishReasons.join(", ") || "no generation"}; completion bound: ${observation.completionBounds.map((bound) => bound ?? "exempt").join(", ") || "no generation"}.`,
      ``, `Student: ${observation.message}`, ``, `Reply: ${observation.answer}`, ``,
      `Rubric: ${observation.rubric}`, ``, `- [ ] Complete sentence(s), correct language and case rubric`,
      `- [ ] Human verdict recorded with reason for any failure`
    ])
  ].join("\n");
  await writeFile(path.join(outputDirectory, "report.md"), markdown);
  console.log(`Live observations and review report: ${outputDirectory}`);
  if (!automaticChecksPass) process.exitCode = 1;
}

main().catch(() => {
  console.error("Concise-chat live evaluation could not complete. Verify the configured API/model and arguments; live verification remains incomplete.");
  process.exitCode = 1;
});
