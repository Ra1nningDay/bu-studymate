import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai";
import { createBotReply } from "@/lib/bot";
import { normalizeWebSessionId } from "@/lib/web-session";

export const runtime = "nodejs";

type ChatRequestBody = {
  message?: unknown;
  sessionId?: unknown;
};

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const reply = await createBotReply({
    channel: "web",
    lineUserId: normalizeWebSessionId(body.sessionId),
    message: body.message
  });

  return NextResponse.json({
    aiConfigured: isAiConfigured(),
    reply: reply.text,
    flexMessage: reply.flexMessage,
    sources: reply.sources ?? [],
    usedWebSearch: Boolean(reply.usedWebSearch)
  });
}
