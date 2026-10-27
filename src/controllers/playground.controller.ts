import { NextResponse } from "next/server";
import { PlaygroundMessageSchema, PlaygroundSessionIdSchema } from "@/src/dtos/playground.dto";
import { adminAuthService } from "@/src/services/admin-auth.service";
import { accessDenied, isSameOrigin } from "@/src/controllers/admin-auth.controller";
import { playgroundService } from "@/src/services/playground.service";
import { chatOrchestrationService } from "@/src/services/chat-orchestration.service";
import { rateLimitService, messageRateLimitConfig } from "@/src/services/rate-limit.service";
import { createSseChatResponse, wantsEventStream } from "@/src/presenters/chat-stream.presenter";
import { normalizeWebSessionId } from "@/lib/web-session";

const privateHeaders = { "Cache-Control": "private, no-store" };
const sendErrorMessage = "ส่งข้อความไม่สำเร็จ ตรวจสอบ trace และการตั้งค่าฐานข้อมูล/AI ก่อนลองใหม่";

export class PlaygroundController {
  constructor(
    private auth = adminAuthService,
    private service = playgroundService,
    private chat = chatOrchestrationService,
    private limiter = rateLimitService
  ) {}

  private async deny(request: Request, need: "read" | "write") {
    const access = await this.auth.authorize(request, need);
    if (access === "ok") return null;
    const { error, status } = accessDenied(access);
    return this.json({ error }, status);
  }

  private json(value: unknown, status = 200) {
    return NextResponse.json(value, { status, headers: privateHeaders });
  }

  async list(request: Request) {
    const denied = await this.deny(request, "read");
    if (denied) return denied;
    try {
      return this.json({ sessions: await this.service.listSessions() });
    } catch {
      return this.json({ error: "ไม่สามารถอ่าน session ได้ ตรวจสอบการเชื่อมต่อฐานข้อมูล" }, 503);
    }
  }

  async read(request: Request, sessionId: string) {
    const denied = await this.deny(request, "read");
    if (denied) return denied;
    if (!PlaygroundSessionIdSchema.safeParse(sessionId).success) return this.json({ error: "Invalid session" }, 400);
    try {
      const conversation = await this.service.getConversation(sessionId);
      return conversation ? this.json({ conversation }) : this.json({ error: "Session not found" }, 404);
    } catch {
      return this.json({ error: "ไม่สามารถอ่านบทสนทนาได้ ตรวจสอบการเชื่อมต่อฐานข้อมูล" }, 503);
    }
  }

  async send(request: Request) {
    const denied = await this.deny(request, "write");
    if (denied) return denied;
    if (!isSameOrigin(request)) return this.json({ error: "Forbidden" }, 403);
    let body: unknown;
    try { body = await request.json(); } catch { return this.json({ error: "Invalid JSON" }, 400); }
    const parsed = PlaygroundMessageSchema.safeParse(body);
    if (!parsed.success) return this.json({ error: "ข้อความหรือ session ไม่ถูกต้อง (ข้อความไม่เกิน 10,000 ตัวอักษร)" }, 400);
    const { sessionId, message } = parsed.data;
    const lineUserId = normalizeWebSessionId(sessionId);
    try {
      const limit = await this.limiter.consume({ lineUserId, ...messageRateLimitConfig });
      if (!limit.allowed) return this.json({ error: "ส่งข้อความถี่เกินไป กรุณารอสักครู่", retryAfterSeconds: limit.retryAfterSeconds }, 429);
      if (wantsEventStream(request)) {
        return createSseChatResponse({
          errorMessage: sendErrorMessage,
          execute: (stream) => this.chat.createBotReply({ channel: "web", lineUserId, message, stream }),
          formatDone: (reply) => ({
            runId: reply.runId ?? null,
            reply: reply.text,
            sources: (reply.sources ?? []).map((source) => source.url)
          })
        });
      }
      const reply = await this.chat.createBotReply({ channel: "web", lineUserId, message });
      return this.json({ runId: reply.runId, reply: reply.text });
    } catch {
      // Some failures have a persisted error run. The client reloads the session to inspect it.
      return this.json({ error: sendErrorMessage }, 503);
    }
  }
}

export const playgroundController = new PlaygroundController();
