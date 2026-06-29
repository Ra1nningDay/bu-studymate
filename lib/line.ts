import crypto from "node:crypto";

type LineTextMessage = {
  type: "text";
  text: string;
};

export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type: string;
    text?: string;
  };
};

function requireLineEnv(name: string) {
  const value = process.env[name];
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

export async function replyLineText(replyToken: string, text: string) {
  const accessToken = requireLineEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const message: LineTextMessage = {
    type: "text",
    text
  };

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [message]
    })
  });

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
  }
}
