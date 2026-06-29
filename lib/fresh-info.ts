import { createWebSearchResponse, type AnswerSource } from "@/lib/ai";

const safeFreshInfoFallback =
  "ยังไม่พบแหล่งข้อมูลทางการที่ยืนยันได้ชัดเจนครับ กรุณาเช็กประกาศจากเว็บไซต์/หน่วยงานของมหาวิทยาลัยโดยตรงเพื่อความชัวร์ครับ";

export type FreshInfoAnswer = {
  sources: AnswerSource[];
  text: string;
  usedWebSearch: boolean;
  usage?: { total_tokens: number };
  model?: string;
};

export async function answerFreshInfoFromVerifiedSources(
  message: string,
  history?: Array<{ content: string; role: "assistant" | "user" }>
): Promise<FreshInfoAnswer> {
  const response = await createWebSearchResponse({
    history,
    message,
    options: { requireOfficialBuSources: true },
    toolType: "web_search_preview"
  });

  if (!response || !response.text || response.text.includes("VERIFIED_SOURCE_NOT_FOUND")) {
    return {
      sources: [],
      text: safeFreshInfoFallback,
      usedWebSearch: true
    };
  }

  return {
    sources: response.sources,
    text: response.text,
    usedWebSearch: true,
    usage: response.usage,
    model: response.model
  };
}

export const freshInfoTestInternals = {};
