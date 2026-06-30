import { z } from "zod";
import { isAiConfigured } from "@/lib/ai";
import type { Intent } from "@/lib/intent";

const routerIntents = [
  "ASK_BU_INFO",
  "ASK_FRESH_INFO",
  "ASK_STUDY_MEMORY",
  "LIST_ASSIGNMENTS",
  "CREATE_TICKET",
  "CHECK_TICKET_STATUS",
  "GENERAL_CHAT",
  "UNKNOWN"
] as const;

const routeTargets = [
  "knowledge_base",
  "web_search",
  "study_memory",
  "ticket",
  "general_chat",
  "unknown"
] as const;

const RouterDecisionSchema = z.object({
  confidence: z.number().min(0).max(1),
  intent: z.enum(routerIntents),
  needsWebSearch: z.boolean(),
  reason: z.string().max(240),
  selectedTarget: z.enum(routeTargets)
});

export type AgentRouterIntent = (typeof routerIntents)[number];
export type RouteTarget = (typeof routeTargets)[number];

export type AgentRouterContext = {
  sessionState?: string | null;
};

export type AgentRouterDecision = z.infer<typeof RouterDecisionSchema> & {
  intent: AgentRouterIntent;
  routerType: "agent_router" | "fallback" | "policy_fallback";
  usage?: { total_tokens: number };
  model?: string;
};

const lowConfidenceThreshold = 0.68;

const routerDecisionJsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: routerIntents
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reason: {
      type: "string",
      maxLength: 240
    },
    selectedTarget: {
      type: "string",
      enum: routeTargets
    },
    needsWebSearch: {
      type: "boolean"
    }
  },
  required: ["intent", "confidence", "reason", "selectedTarget", "needsWebSearch"],
  additionalProperties: false
} as const;

function fallbackDecision(reason: string): AgentRouterDecision {
  return {
    confidence: 0,
    intent: "UNKNOWN",
    needsWebSearch: false,
    reason,
    routerType: "fallback",
    selectedTarget: "unknown"
  };
}

function policyFallback(reason: string): AgentRouterDecision {
  return {
    confidence: 0,
    intent: "UNKNOWN",
    needsWebSearch: false,
    reason,
    routerType: "policy_fallback",
    selectedTarget: "unknown"
  };
}

function expectedTarget(intent: AgentRouterIntent): RouteTarget {
  if (intent === "ASK_BU_INFO") return "knowledge_base";
  if (intent === "ASK_FRESH_INFO") return "web_search";
  if (intent === "ASK_STUDY_MEMORY" || intent === "LIST_ASSIGNMENTS") {
    return "study_memory";
  }
  if (intent === "CREATE_TICKET" || intent === "CHECK_TICKET_STATUS") return "ticket";
  if (intent === "GENERAL_CHAT") return "general_chat";
  return "unknown";
}

export function validateRouterPolicy(
  decision: z.infer<typeof RouterDecisionSchema>
): AgentRouterDecision {
  if (decision.confidence < lowConfidenceThreshold) {
    return policyFallback(`Low confidence router decision: ${decision.reason}`);
  }

  const target = expectedTarget(decision.intent);
  if (decision.selectedTarget !== target) {
    return policyFallback(
      `Router intent/target conflict: ${decision.intent}/${decision.selectedTarget}`
    );
  }

  if (decision.intent === "ASK_FRESH_INFO" && !decision.needsWebSearch) {
    return policyFallback("Fresh info route must use verified web search");
  }

  if (decision.intent !== "ASK_FRESH_INFO" && decision.needsWebSearch) {
    return policyFallback("Only fresh info route may use verified web search");
  }

  if (
    (decision.intent === "ASK_STUDY_MEMORY" || decision.intent === "LIST_ASSIGNMENTS") &&
    decision.selectedTarget !== "study_memory"
  ) {
    return policyFallback("Study Memory route must stay on saved notes only");
  }

  return {
    ...decision,
    routerType: "agent_router"
  };
}

function parseRouterResponse(data: {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
}) {
  const text =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text;

  if (!text) {
    return null;
  }

  try {
    return RouterDecisionSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function classifyWithAgentRouter(
  message: string,
  context: AgentRouterContext = {}
): Promise<AgentRouterDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !isAiConfigured()) {
    return fallbackDecision("Agent Router unavailable: OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_AGENT_ROUTER_MODEL || "gpt-4.1-mini",
      store: false,
      input: [
        {
          role: "system",
          content:
            "You are BU StudyMate's routing classifier. Return only the structured routing decision. " +
            "Do not answer the student. Do not call tools. Do not mutate data. " +
            "Route saved-note/class/assignment questions to Study Memory only. " +
            "Route current, changing, dated, opening-hours, schedule, news, holiday, admission-round, fee, or deadline questions to fresh info. " +
            "Route stable Bangkok University how-to information, locations, departments, and contact info to the knowledge base. " +
            "Route short keywords or terms related to BU (e.g., app names, places) to the knowledge base. " +
            "Route room/facility/lost-item problems to ticket creation. " +
            "Use UNKNOWN when the message is completely ambiguous or unrelated to the university."
        },
        {
          role: "user",
          content: JSON.stringify({
            context: {
              sessionState: context.sessionState ?? null
            },
            examples: [
              {
                intent: "ASK_FRESH_INFO",
                message: "มหาลัยหยุดวันไหนบ้าง",
                selectedTarget: "web_search"
              },
              {
                intent: "ASK_FRESH_INFO",
                message: "วันนี้ BU เปิดไหม",
                selectedTarget: "web_search"
              },
              {
                intent: "ASK_FRESH_INFO",
                message: "สมัครเข้า BU ทำยังไงบ้าง",
                selectedTarget: "web_search"
              },
              {
                intent: "ASK_FRESH_INFO",
                message: "ที่นี่สมัครยังไงบ้าง",
                selectedTarget: "web_search"
              },
              {
                intent: "ASK_BU_INFO",
                message: "BU Mobile",
                selectedTarget: "knowledge_base"
              },
              {
                intent: "ASK_BU_INFO",
                message: "BU Wi-Fi ใช้ยังไง",
                selectedTarget: "knowledge_base"
              },
              {
                intent: "LIST_ASSIGNMENTS",
                message: "งาน Data Structure ส่งวันไหน",
                selectedTarget: "study_memory"
              },
              {
                intent: "ASK_STUDY_MEMORY",
                message: "อาจารย์พูดเรื่อง Queue ว่ายังไง",
                selectedTarget: "study_memory"
              },
              {
                intent: "CREATE_TICKET",
                message: "ห้อง A3 แอร์ไม่เย็น",
                selectedTarget: "ticket"
              },
              {
                intent: "CHECK_TICKET_STATUS",
                message: "เช็ก ticket BU-TICKET-0001",
                selectedTarget: "ticket"
              }
            ],
            message
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "bu_studymate_agent_router",
          schema: routerDecisionJsonSchema,
          strict: true
        }
      },
      max_output_tokens: 220
    })
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    output_text?: string;
    usage?: { total_tokens: number };
    model?: string;
  };

  if (!response.ok) {
    const message = data.error?.message
      ? `Agent Router failed: ${data.error.message}`
      : `Agent Router failed: ${response.status}`;
    console.warn(message);
    return fallbackDecision("Agent Router request failed");
  }

  const parsed = parseRouterResponse(data);
  if (!parsed) {
    return fallbackDecision("Agent Router returned an invalid structured decision");
  }

  const validated = validateRouterPolicy(parsed);
  validated.usage = data.usage;
  validated.model = data.model;
  return validated;
}

export function isRouterIntent(intent: Intent): intent is AgentRouterIntent {
  return routerIntents.includes(intent as AgentRouterIntent);
}
