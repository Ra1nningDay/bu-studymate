import { env } from "@/src/config/env";
import { consumeChatCompletionStream, isEventStreamResponse } from "@/lib/openai-stream";

export async function generateStudyAnswer(
  question: string,
  context: string,
  isThai: boolean = true,
  onTextDelta?: (delta: string) => void
) {
  const trimmedContext = context.trim();
  const missingStudyInfoReply = isThai
    ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ"
    : "I couldn't find this information in your saved notes.";

  if (!trimmedContext) {
    onTextDelta?.(missingStudyInfoReply);
    return missingStudyInfoReply;
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    const slice = trimmedContext.slice(0, 1000);
    onTextDelta?.(slice);
    return slice;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        max_completion_tokens: 8192,
        ...(onTextDelta ? { stream: true, stream_options: { include_usage: true } } : {}),
        messages: [
          {
            role: "system",
            content:
              `You are BU StudyMate's Study Memory answerer. Answer only from the provided saved note context. ` +
              `Do not use web search or general knowledge. If the context does not contain the answer, reply exactly: "${missingStudyInfoReply}". ` +
              "Answer in a friendly, conversational, and helpful assistant tone. You MUST reply in the exact same language as the user's question, translating the context if necessary. Keep it concise for LINE chat. " +
              "When the user asks for explanation, review questions, flashcards, or exam summary, transform the saved note into a teaching response. Do not copy long raw sentences verbatim. Avoid diary-style phrasing like 'today we learned' or 'วันนี้เรียน' unless the user explicitly asks for a class log. " +
              "Summarize and explain the answer clearly instead of just copy-pasting the raw text. Do NOT use any Markdown formatting (no **bold**, no *italic*)."
          },
          {
            role: "user",
            content: `Question:\n${question}\n\nSaved note context:\n${trimmedContext}`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Study answer generation failed", await response.text());
      onTextDelta?.(missingStudyInfoReply);
      return missingStudyInfoReply;
    }

    if (onTextDelta && isEventStreamResponse(response)) {
      let pendingStar = false;
      let started = false;
      const streamed = await consumeChatCompletionStream(response, (delta) => {
        const combined = (pendingStar ? "*" : "") + delta;
        pendingStar = combined.endsWith("*") && !combined.endsWith("**");
        const consumable = pendingStar ? combined.slice(0, -1) : combined;
        const withoutBold = consumable.replace(/\*\*/g, "");
        const piece = started ? withoutBold : withoutBold.replace(/^\s+/, "");
        if (piece.length > 0) {
          started = true;
          onTextDelta(piece);
        }
      });
      if (pendingStar) {
        onTextDelta("*");
      }
      const answer = streamed.content.trim().replace(/\*\*/g, "");
      if (!answer) {
        onTextDelta(missingStudyInfoReply);
        return missingStudyInfoReply;
      }
      return answer;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = data.choices?.[0]?.message?.content?.trim();
    const cleaned = answer ? answer.replace(/\*\*/g, "") : missingStudyInfoReply;
    onTextDelta?.(cleaned);
    return cleaned;
  } catch (error) {
    console.error("Study answer generation error", error);
    onTextDelta?.(missingStudyInfoReply);
    return missingStudyInfoReply;
  }
}
