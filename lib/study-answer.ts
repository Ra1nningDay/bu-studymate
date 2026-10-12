import { env } from "@/src/config/env";

export async function generateStudyAnswer(question: string, context: string, isThai: boolean = true) {
  const trimmedContext = context.trim();
  if (!trimmedContext) {
    return isThai ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" : "I couldn't find this information in your saved notes.";
  }

  const missingStudyInfoReply = isThai ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" : "I couldn't find this information in your saved notes.";

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return trimmedContext.slice(0, 1000);
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
        temperature: 0,
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
      return missingStudyInfoReply;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = data.choices?.[0]?.message?.content?.trim();
    return answer ? answer.replace(/\*\*/g, "") : missingStudyInfoReply;
  } catch (error) {
    console.error("Study answer generation error", error);
    return missingStudyInfoReply;
  }
}
