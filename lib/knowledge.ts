import { rewriteKnowledgeAnswer } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import type { KnowledgeItem } from "@/lib/types";

const FALLBACK_NO_INFO =
  "ขออภัยครับ ตอนนี้ StudyMate ยังไม่มีข้อมูลที่ยืนยันได้เพียงพอสำหรับคำถามนี้";

function normalize(input: string) {
  return input.toLowerCase().trim();
}

function scoreKnowledgeItem(query: string, item: KnowledgeItem) {
  const q = normalize(query);
  const tokens = q.split(/[\s,.;:!?()"'“”‘’\[\]{}]+/).filter(Boolean);
  let score = 0;

  for (const keyword of item.keywords ?? []) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword && q.includes(normalizedKeyword)) {
      score += 12;
    }
  }

  const title = normalize(item.title);
  const category = normalize(item.category);
  const content = normalize(item.content);

  if (q.includes(title) || title.includes(q)) score += 8;
  if (q.includes(category) || category.includes(q)) score += 5;
  if (content.includes(q)) score += 4;

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (title.includes(token)) score += 5;
    if (category.includes(token)) score += 3;
    if (content.includes(token)) score += 1;
    if (item.keywords?.some((keyword) => normalize(keyword).includes(token))) {
      score += 4;
    }
  }

  return score;
}

export async function searchKnowledge(query: string) {
  const data = await prisma.knowledgeItem.findMany({
    take: 100,
    orderBy: { updatedAt: "desc" }
  });

  const ranked = data
    .map(
      (item): KnowledgeItem => ({
        id: item.id,
        title: item.title,
        category: item.category,
        content: item.content,
        keywords: item.keywords,
        source: item.source,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString()
      })
    )
    .map((item) => ({ item, score: scoreKnowledgeItem(query, item) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 3) {
    return null;
  }

  return best.item;
}

export async function answerKnowledgeQuestion(
  query: string,
  history: Array<{ content: string; role: "assistant" | "user" }> = []
) {
  const item = await searchKnowledge(query);
  if (!item) {
    return { text: FALLBACK_NO_INFO, usage: undefined, model: undefined, isMiss: true };
  }

  const result = await rewriteKnowledgeAnswer({
    context: item.content,
    history,
    question: query
  });
  
  if (result.text === "NO_VERIFIED_INFO_FOUND") {
    return { text: FALLBACK_NO_INFO, usage: result.usage, model: result.model, isMiss: true };
  }

  return { ...result, isMiss: false };
}

// TODO: Add pgvector retrieval using match_knowledge_items after the MVP LINE
// webhook, ticket flow, and admin dashboard are stable in production.
