import { env } from "@/src/config/env";

export async function extractTicketDraftFromLLM(message: string): Promise<{ location?: string; room?: string; description?: string } | null> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        max_completion_tokens: 1536,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an assistant that extracts ticket issue details from messages. Extract 'location' (building/place), 'room', and 'description' (the problem itself). Output JSON with these 3 keys. If a field is not mentioned, omit it or set it to null."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      location: parsed.location || undefined,
      room: parsed.room || undefined,
      description: parsed.description || undefined
    };
  } catch (err) {
    console.error("LLM ticket extraction failed", err);
    return null;
  }
}
