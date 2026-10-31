import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";

/**
 * Workflow graph confirmed against source on 2026-10-31:
 * ChatOrchestrationService.hardGuardRoute/resolveRoute/executeBotReply,
 * classifyWithAgentRouter (src/lib/router/agent-router.ts), KnowledgeService,
 * answerFreshInfoFromVerifiedSources (src/lib/fresh-info.ts).
 * Do not add a node or edge unless that code path exists.
 */
export type WorkflowNodeKind = "input" | "guard" | "router" | "agent" | "retrieval" | "llm" | "tool" | "output";
export type WorkflowIcon = "message" | "shield" | "branch" | "search" | "layers" | "list" | "sparkles" | "globe" | "link" | "book" | "ticket" | "chat" | "output";
export type NodeState = "success" | "fallback" | "failed" | "skipped" | "unknown" | "unrecorded" | "idle";

export type WorkflowNodeDef = {
  id: string;
  label: string;
  kind: WorkflowNodeKind;
  icon: WorkflowIcon;
  /** Recorded `executionLog[].action` values that belong to this node. */
  actions?: string[];
  /** Router `selectedTarget` values that enter this node when it has no fine-grained actions. */
  targets?: string[];
  source: string;
  description: string;
  inputs: string;
  outputs: string;
};

export type WorkflowEdgeDef = { id: string; from: string; to: string; label?: string; when?: "fallback" };

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 64;

export const workflowNodes: WorkflowNodeDef[] = [
  { id: "user_query", label: "User Query", kind: "input", icon: "message", source: "src/controllers/chat.controller.ts · line-webhook.controller.ts",
    description: "ข้อความจาก Web Chat หรือ LINE ที่ผ่านการตรวจรูปแบบแล้ว", inputs: "ข้อความผู้ใช้ (LINE / Web)", outputs: "ข้อความที่ trim แล้วส่งเข้า ChatOrchestrationService" },
  { id: "agent_router", label: "Guards & Router", kind: "router", icon: "branch", actions: ["Agent Router Decision"], source: "ChatOrchestrationService.hardGuardRoute · src/lib/router/agent-router.ts",
    description: "ตรวจ hard guard ก่อน (เมนู greeting, รีเซ็ต/ยกเลิก, สถานะสร้าง ticket, /addnote, รหัส ticket) ถ้าไม่ตรงจึงให้ Agent Router จำแนก intent/target ด้วย Jev (สำรองด้วย OpenAI) และตรวจนโยบายความมั่นใจ/ความปลอดภัย",
    inputs: "ข้อความ + สถานะ session + ประวัติ 2 ข้อความล่าสุด", outputs: "intent, selectedTarget, confidence, reason, needsWebSearch, safetyCritical" },
  { id: "query_rewrite", label: "Query Rewrite", kind: "llm", icon: "sparkles", actions: ["Query Rewrite"], source: "src/services/knowledge.service.ts · src/lib/rag",
    description: "ปรับคำถามต่อเนื่องให้ค้นได้เมื่อจำเป็น มิฉะนั้นใช้คำถามเดิม", inputs: "คำถาม + ประวัติสนทนา", outputs: "คำถามที่ใช้ค้น" },
  { id: "hybrid_retrieval", label: "Hybrid Retrieval", kind: "retrieval", icon: "search", actions: ["Hybrid Retrieval"], source: "KnowledgeService.retrieve · knowledge repository",
    description: "ค้น keyword + vector จาก corpus ที่อนุมัติแล้ว และรวมอันดับด้วย RRF ใน SQL", inputs: "คำถามที่ใช้ค้น + embedding", outputs: "Candidates สูงสุด 40 รายการ" },
  { id: "rrf_fusion", label: "RRF Fusion", kind: "retrieval", icon: "layers", actions: ["RRF Fusion"], source: "KnowledgeService.retrieve (trace)",
    description: "ขั้นบันทึกผลรวมอันดับ เวลาถูกนับรวมใน Hybrid Retrieval (SQL) จึงไม่มีเวลาแยก", inputs: "ผลค้น keyword + vector", outputs: "Candidates ที่เรียงตาม RRF" },
  { id: "reranker", label: "Reranker", kind: "llm", icon: "list", actions: ["Reranker"], source: "src/lib/rag (rerankKnowledge)",
    description: "จัดอันดับ candidates ใหม่ด้วย LLM ถ้าล้มเหลวใช้ลำดับ RRF", inputs: "คำถาม + candidates", outputs: "ข้อความหลักฐานที่เลือก (สูงสุด 5)" },
  { id: "llm_generation", label: "LLM Generation", kind: "llm", icon: "sparkles", actions: ["LLM Generation"], source: "KnowledgeService.answerQuestion",
    description: "สร้างคำตอบจากหลักฐานพร้อม citations ถ้าไม่มีหลักฐานจะถือว่าไม่พบ", inputs: "หลักฐานที่เลือก + ประวัติ", outputs: "คำตอบพร้อม citations หรือ NO_VERIFIED_INFO_FOUND" },
  { id: "bulinks_lookup", label: "BU Links Lookup", kind: "tool", icon: "link", actions: ["BU Links Lookup"], source: "src/lib/fresh-info.ts · src/services/bulinks.service.ts",
    description: "ลองค้นประกาศ/หน้าบริการจาก BU Links สดก่อน โดยไม่ใช้ LLM", inputs: "ข้อความผู้ใช้", outputs: "ข้อความพร้อมลิงก์ หรือไม่มีผล (ไปต่อที่ Web Search)" },
  { id: "web_search", label: "Web Search", kind: "tool", icon: "globe", actions: ["Search Fresh Info (Web Search)"], source: "src/lib/fresh-info.ts",
    description: "ค้นข้อมูลล่าสุดด้วย web search ผ่านแหล่งที่ตรวจแล้ว", inputs: "ข้อความ + ประวัติ", outputs: "คำตอบพร้อมแหล่งข้อมูล" },
  { id: "study_memory", label: "Study Memory", kind: "agent", icon: "book", targets: ["study_memory"], source: "src/services/study-memory.service.ts",
    description: "บันทึกโน้ต ดูสมุดโน้ต/งานที่ได้รับ และตอบจากบทเรียนของผู้ใช้", inputs: "LINE user + ข้อความ", outputs: "ข้อความ/Flex ที่อ้างอิงข้อมูลบทเรียน" },
  { id: "ticket", label: "Support Tickets", kind: "agent", icon: "ticket", targets: ["ticket"], source: "src/services/ticket.service.ts",
    description: "ดำเนินขั้นตอนแจ้งปัญหา ยืนยัน หรือค้นสถานะ ticket", inputs: "LINE user + ข้อความ + ticket session", outputs: "ข้อความ/Flex ของ ticket" },
  { id: "general_chat", label: "Chat & Policy", kind: "agent", icon: "chat", targets: ["general_chat", "out_of_scope", "unknown"], source: "chat-orchestration.service.ts · src/lib/ai.ts",
    description: "สนทนาทั่วไป ถามให้ชัดเจน ตอบตามขอบเขต หรือแสดงคำแนะนำ/รีเซ็ต", inputs: "ข้อความ + ประวัติ", outputs: "คำตอบทั่วไป/คำถามขอรายละเอียด/ข้อความตามขอบเขต" },
  { id: "output", label: "Output", kind: "output", icon: "output", actions: ["Output"], source: "ChatOrchestrationService.executeBotReply",
    description: "ต่อรายการแหล่งข้อมูลท้ายคำตอบ ส่งเข้า stream และบันทึกคำตอบ", inputs: "คำตอบจาก branch ที่เลือก", outputs: "ข้อความตอบกลับ + citations" }
];

export const workflowEdges: WorkflowEdgeDef[] = [
  { id: "user-router", from: "user_query", to: "agent_router" },
  { id: "router-rewrite", from: "agent_router", to: "query_rewrite", label: "knowledge_base" },
  { id: "router-bulinks", from: "agent_router", to: "bulinks_lookup", label: "web_search" },
  { id: "router-study", from: "agent_router", to: "study_memory", label: "study_memory" },
  { id: "router-ticket", from: "agent_router", to: "ticket", label: "ticket" },
  { id: "router-chat", from: "agent_router", to: "general_chat", label: "general / unknown" },
  { id: "rewrite-retrieval", from: "query_rewrite", to: "hybrid_retrieval" },
  { id: "retrieval-rrf", from: "hybrid_retrieval", to: "rrf_fusion" },
  { id: "rrf-rerank", from: "rrf_fusion", to: "reranker" },
  { id: "rerank-llm", from: "reranker", to: "llm_generation" },
  { id: "llm-bulinks", from: "llm_generation", to: "bulinks_lookup", label: "ไม่พบหลักฐาน", when: "fallback" },
  { id: "bulinks-web", from: "bulinks_lookup", to: "web_search", label: "ไม่มีผล", when: "fallback" },
  { id: "llm-output", from: "llm_generation", to: "output" },
  { id: "bulinks-output", from: "bulinks_lookup", to: "output" },
  { id: "web-output", from: "web_search", to: "output" },
  { id: "study-output", from: "study_memory", to: "output" },
  { id: "ticket-output", from: "ticket", to: "output" },
  { id: "chat-output", from: "general_chat", to: "output" }
];

export const stateLabel: Record<NodeState, string> = {
  success: "Success", fallback: "Fallback", failed: "Failed", skipped: "Skipped", unknown: "Unknown", unrecorded: "Not Recorded", idle: "Idle"
};
export const stateHint: Record<NodeState, string> = {
  success: "ทำงานสำเร็จตามที่บันทึก", fallback: "ใช้ทางสำรองหรือ fallback ตามที่บันทึก", failed: "ขั้นตอนนี้ล้มเหลวตามที่บันทึก",
  skipped: "ถูกข้ามตามที่บันทึก", unknown: "มีร่องรอยว่าทำงาน แต่ไม่ได้บันทึกผลลัพธ์", unrecorded: "เส้นทางนี้ถูกเลือก แต่ไม่ได้บันทึกขั้นตอน", idle: "ไม่ได้ใช้ใน run นี้"
};
const done: NodeState[] = ["success", "fallback", "failed", "unknown"];
export const isDone = (state: NodeState) => done.includes(state);

export type WorkflowRunInput = {
  steps: ExecutionLogEntry[];
  target?: string | null;
  routerType?: string | null;
  runStatus?: string | null;
  hasAnswer: boolean;
  errorCode?: string | null;
};
export type NodeRunInfo = { state: NodeState; stepIndexes: number[]; durationMs?: number; note?: string };
export type WorkflowRunState = { nodes: Record<string, NodeRunInfo>; edges: Record<string, boolean> };

const fromStatus = (step: ExecutionLogEntry): NodeState =>
  step.status === "applied" ? "success" : step.status === "fallback" ? "fallback" : step.status === "error" ? "failed" : step.status === "skipped" ? "skipped" : "unknown";

function worst(states: NodeState[]): NodeState {
  for (const state of ["failed", "fallback", "unknown", "skipped"] as NodeState[]) if (states.includes(state)) return state;
  return "success";
}

/** Maps one saved run to node/edge states. Anything the log cannot prove is `unrecorded` or `unknown`. */
export function deriveRunState(run: WorkflowRunInput | null): WorkflowRunState {
  const nodes: Record<string, NodeRunInfo> = {};
  for (const node of workflowNodes) nodes[node.id] = { state: "idle", stepIndexes: [] };
  if (!run) return { nodes, edges: {} };

  const { steps, target, routerType } = run;
  const claimed = new Set<number>();
  for (const node of workflowNodes) {
    if (!node.actions) continue;
    const indexes = steps.flatMap((step, index) => node.actions!.includes(step.action) ? [index] : []);
    indexes.forEach(index => claimed.add(index));
    if (indexes.length) {
      const first = steps[indexes[0]];
      nodes[node.id] = { state: worst(indexes.map(index => fromStatus(steps[index]))), stepIndexes: indexes,
        durationMs: node.id === "rrf_fusion" ? undefined : first.durationMs };
    }
  }

  nodes.user_query = { state: "success", stepIndexes: [] };
  const guarded = routerType === "hard_guard";
  const routed = routerType === "agent_router" || routerType === "fallback" || routerType === "policy_fallback";
  if (!nodes.agent_router.stepIndexes.length) {
    nodes.agent_router = guarded || routed ? { state: routerType === "policy_fallback" || routerType === "fallback" ? "fallback" : "success", stepIndexes: [], note: "อ่านจาก routerType ไม่ได้บันทึกขั้นตอนหรือเวลา" } : { state: "unrecorded", stepIndexes: [] };
  }
  if (guarded) nodes.agent_router.note = "ข้อความตรง hard guard จึงตอบโดยไม่เรียก LLM router";
  else if (routed) nodes.agent_router.note = `ไม่ตรง hard guard · Agent Router (${routerType})`;

  // Entry nodes without fine-grained steps: reached when the recorded target says so.
  const consumedByRouting = new Set(steps.flatMap((step, index) => ["Agent Router Decision", "Output"].includes(step.action) ? [index] : []));
  const laneSteps = steps.flatMap((_, index) => claimed.has(index) || consumedByRouting.has(index) ? [] : [index]);
  const runOk = run.runStatus === "success" && !run.errorCode;
  for (const node of workflowNodes) {
    if (!node.targets) continue;
    if (target && node.targets.includes(target)) {
      nodes[node.id] = { state: runOk ? "success" : "unknown", stepIndexes: laneSteps,
        note: runOk ? "อ่านจาก selectedTarget และสถานะ run (ขั้นย่อยไม่มีเวลาแยก)" : "เลือกเส้นทางนี้ แต่ run ไม่สำเร็จหรือไม่มีผลลัพธ์ที่บันทึก" };
    } else if (!target) nodes[node.id] = { state: "unrecorded", stepIndexes: [] };
  }

  // Action-based lanes: an unmatched node is "not recorded" only when its lane was chosen.
  const knowledgeIds = ["query_rewrite", "hybrid_retrieval", "rrf_fusion", "reranker", "llm_generation"];
  const knowledgeActive = target === "knowledge_base";
  for (const id of knowledgeIds) if (nodes[id].state === "idle" && knowledgeActive) nodes[id] = { state: "unrecorded", stepIndexes: [] };
  const freshActive = target === "web_search" || nodes.bulinks_lookup.stepIndexes.length > 0 || nodes.web_search.stepIndexes.length > 0;
  if (freshActive) {
    if (nodes.bulinks_lookup.state === "idle" && !nodes.bulinks_lookup.stepIndexes.length) {
      nodes.bulinks_lookup = { state: "unrecorded", stepIndexes: [], note: nodes.web_search.stepIndexes.length ? "ไม่มีผลลัพธ์ BU Links ก่อนไปต่อที่ Web Search (ไม่ได้บันทึกขั้นนี้)" : undefined };
    }
    if (nodes.web_search.state === "idle" && !nodes.bulinks_lookup.stepIndexes.length) nodes.web_search = { state: "unrecorded", stepIndexes: [] };
  }

  if (!nodes.output.stepIndexes.length) {
    nodes.output = { state: run.hasAnswer ? "unknown" : "unrecorded", stepIndexes: [], note: run.hasAnswer ? "มีคำตอบที่บันทึก แต่ไม่ได้บันทึกขั้นตอน Output" : undefined };
  }

  const edges: Record<string, boolean> = {};
  for (const edge of workflowEdges) {
    const from = nodes[edge.from].state;
    const to = nodes[edge.to].state;
    edges[edge.id] = edge.when === "fallback" ? isDone(to) && ["skipped", "fallback", "failed", "unrecorded"].includes(from)
      : isDone(from) && isDone(to);
  }
  // BU Links is always tried before Web Search, so a recorded Web Search step implies the lookup was passed through.
  const freshDone = isDone(nodes.bulinks_lookup.state) || isDone(nodes.web_search.state);
  edges["router-bulinks"] = isDone(nodes.agent_router.state) && target === "web_search" && freshDone;
  edges["llm-bulinks"] = target === "knowledge_base" && ["skipped", "fallback", "failed"].includes(nodes.llm_generation.state) && freshDone;
  edges["bulinks-web"] = isDone(nodes.web_search.state) && !isDone(nodes.bulinks_lookup.state);
  return { nodes, edges };
}
