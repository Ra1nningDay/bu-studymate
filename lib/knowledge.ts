/**
 * Facade for backward compatibility.
 * Core knowledge logic has been refactored to src/services/knowledge.service.ts
 */
export {
  knowledgeService,
  KnowledgeService
} from "@/src/services/knowledge.service";

import { knowledgeService } from "@/src/services/knowledge.service";

export async function searchKnowledge(query: string) {
  return knowledgeService.search(query);
}

export async function answerKnowledgeQuestion(
  query: string,
  history: Array<{ content: string; role: "assistant" | "user" }> = []
) {
  return knowledgeService.answerQuestion(query, history);
}
