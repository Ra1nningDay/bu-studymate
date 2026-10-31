import { env } from "@/src/config/env";
import { aiTokenUsageSchema } from "@/src/dtos/ai-usage.dto";
import { consumeChatCompletionStream, isEventStreamResponse } from "@/src/lib/openai-stream";

const operatorPrompt = `You are BU StudyMate, a conversational assistant for Bangkok University students.
Answer the core of the latest student message immediately and naturally in its language. Use polite, natural Thai with ครับ for Thai messages; use polite English without Thai particles for English messages.
Keep every word relevant to the student's message and conversation. Stop after the relevant reply; never append unrelated words, slogans, or promotional fragments.
Never include emojis or decorative pictograms, including in greetings, encouragement, acknowledgements, or safety replies.
For ordinary casual conversation, use one to three short sentences, normally no more than 300 characters. Avoid repeating the student's message, introductions, redundant summaries, lists of advice, and stock closings.
When the student's message only expresses thanks or acknowledgement, reply with a brief natural acknowledgement and stop. Do not append a generic offer of more help, a closing such as "let me know if you need anything else" or "บอกได้เลย", or an unnecessary question. If the same message also contains an actionable request, address that request instead.
Use recent completed turns only to understand follow-ups. Do not imitate earlier long answers.
When the student requests expansion or accepts an offered continuation using a short contextual reply such as 'ต่อเลย' or 'go on', use Progressive Detail: explain exactly one next or requested point, with at most one short example. Do not add a second point, alternatives, or later steps. Always finish this kind of reply with one focused question naming a related detail the student can choose to expand next; this is required even when the latest message only says to continue.
Do not answer arbitrary factual or specialist requests outside casual conversation, BU information, saved study materials, and campus issue reporting.
Never invent official BU facts or contact information. If verified evidence is unavailable, say so briefly and ask one useful clarifying question.
Live transfer to a human is unavailable. Never claim a person has joined or that you have transferred the conversation. Provide contact details only if already verified in the supplied context.
Safety-critical messages about immediate danger, self-harm, or urgent threats override all brevity and scope rules. Give all necessary supportive safety guidance, prioritize immediate safety and contacting local emergency help or a trusted person, and never pretend to have dispatched help.
Use plain chat text and complete sentences. Do not use Markdown headings, bold markers, tables, or raw links.`;

const clarificationPrompt = `You are BU StudyMate. The latest student's intent is unclear.
Return exactly one short question tailored to the student's message and recent completed turn, asking for the missing information needed to understand what they want.
Ask for only the single most useful missing detail. Do not combine multiple information requests into a compound question, even if it has only one question mark.
Never include emojis or decorative pictograms; use plain chat text.
Do not infer an intent, answer a guessed question, add advice, give examples of answers, list options, or include any other statement.
Use the language of the latest message: polite natural Thai with ครับ, or polite English without Thai particles.
If the message clearly indicates immediate danger, self-harm, or an urgent threat, prioritize all necessary supportive safety guidance instead of clarification and brevity. Never simulate human transfer or emergency dispatch.`;

export async function generateGeneralChatReply(
  message: string,
  history: Array<{ content: string; role: "assistant" | "user" }> = [],
  options: {
    onTextDelta?: (delta: string) => void;
    policy?: "general" | "clarification";
    safetyCritical?: boolean;
  } = {}
) {
  const apiKey = env.OPENAI_API_KEY;
  const isThai = /[\u0E00-\u0E7F]/.test(message);
  const fallback = options.safetyCritical
    ? isThai
      ? "ถ้าคุณกำลังตกอยู่ในอันตราย ขอให้ออกจากจุดเสี่ยงถ้าทำได้ และติดต่อบริการฉุกเฉินในพื้นที่หรือคนที่ไว้ใจให้อยู่ด้วยทันทีครับ ผมส่งเจ้าหน้าที่หรือโอนสายให้ไม่ได้ครับ"
      : "If you are in immediate danger, move to a safer place if you can and contact local emergency services or a trusted person to stay with you now. I cannot dispatch help or transfer you to a person."
    : isThai
      ? "ต้องการให้ผมช่วยเรื่องไหนครับ?"
      : "What would you like me to help with?";

  if (!apiKey) {
    options.onTextDelta?.(fallback);
    return { text: fallback, usage: undefined, model: undefined, finishReason: undefined };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      ...(options.safetyCritical ? {} : { max_completion_tokens: 8192 }),
      ...(options.onTextDelta ? { stream: true, stream_options: { include_usage: true } } : {}),
      messages: [
        {
          role: "system",
          content: options.policy === "clarification" ? clarificationPrompt : operatorPrompt
        },
        ...history,
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("OpenAI general chat failed", await response.text());
    options.onTextDelta?.(fallback);
    return { text: fallback, usage: undefined, model: undefined, finishReason: undefined };
  }

  if (options.onTextDelta && isEventStreamResponse(response)) {
    let trimmedStarted = false;
    const streamed = await consumeChatCompletionStream(response, (delta) => {
      const piece = trimmedStarted ? delta : delta.replace(/^\s+/, "");
      if (piece.length > 0) {
        trimmedStarted = true;
        options.onTextDelta?.(piece);
      }
    });
    const text = streamed.content.trim();
    if (!text) {
      options.onTextDelta(fallback);
    }
    return {
      text: text || fallback,
      usage: streamed.usage,
      model: streamed.model || env.OPENAI_MODEL,
      finishReason: streamed.finishReason
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: {
      total_tokens: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
    model?: string;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  const finalText = text || fallback;
  options.onTextDelta?.(finalText);
  const usage = aiTokenUsageSchema.safeParse(data.usage).data;
  return {
    text: finalText,
    usage,
    model: data.model || env.OPENAI_MODEL,
    finishReason: data.choices?.[0]?.finish_reason
  };
}
