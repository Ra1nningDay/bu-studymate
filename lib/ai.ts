const systemPrompt = `You are BU StudyMate, a friendly Bangkok University AI assistant.
Answer the student's question using only the provided context.
If the context does not contain the answer, say that you do not have enough verified information yet.
Do not invent official university policies, tuition fees, deadlines, requirements, or procedures.
Keep the answer concise, helpful, and suitable for LINE chat.
Answer in Thai by default, unless the user asks in English.`;

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function rewriteKnowledgeAnswer({
  question,
  context
}: {
  question: string;
  context: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return context;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Question:\n${question}\n\nVerified context:\n${context}`
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("OpenAI answer rewrite failed", await response.text());
    return context;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || context;
}
