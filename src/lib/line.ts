import crypto from "node:crypto";
import { env } from "@/src/config/env";

export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    fileName?: string;
    fileSize?: number;
    id?: string;
    markAsReadToken?: string;
    mimeType?: string;
    text?: string;
    type: string;
  };
};

function requireLineEnv(name: "LINE_CHANNEL_SECRET" | "LINE_CHANNEL_ACCESS_TOKEN") {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function verifyLineSignature(body: string, signature: string | null) {
  if (!signature) {
    return false;
  }

  const secret = requireLineEnv("LINE_CHANNEL_SECRET");
  const digest = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
}

export async function markLineMessageAsRead(markAsReadToken: string) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");

  try {
    await fetch("https://api.line.me/v2/bot/chat/markAsRead", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ markAsReadToken })
    });
  } catch {
    // Non-critical — never block the reply if mark-read fails
  }
}

export async function showLineLoadingAnimation(chatId: string, loadingSeconds = 20) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");

  try {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ chatId, loadingSeconds })
    });
  } catch {
    // Non-critical — never block the reply if loading animation fails
  }
}

export async function replyLineText(replyToken: string, text: string, quickReply?: any) {
  const message: Record<string, any> = { type: "text", text };
  if (quickReply) {
    message.quickReply = quickReply;
  }
  return replyLineMessage(replyToken, [message]);
}

export async function replyLineMessage(replyToken: string, messages: any[]) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
  }
}

export async function pushLineMessage(to: string, messages: any[]) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ to, messages })
  });

  if (!response.ok) {
    throw new Error(`LINE push failed: ${response.status} ${await response.text()}`);
  }
}

export async function getLineMessageContent(messageId: string) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`LINE content download failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
