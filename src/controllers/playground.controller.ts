import { NextResponse } from "next/server";
import { PlaygroundMessageSchema, PlaygroundSessionIdSchema } from "@/src/dtos/playground.dto";
import { adminAuthService } from "@/src/services/admin-auth.service";
import { isSameOrigin } from "@/src/controllers/admin-auth.controller";
import { playgroundService } from "@/src/services/playground.service";
import { chatOrchestrationService } from "@/src/services/chat-orchestration.service";
import { rateLimitService, messageRateLimitConfig } from "@/src/services/rate-limit.service";
import { normalizeWebSessionId } from "@/lib/web-session";

const privateHeaders = { "Cache-Control": "private, no-store" };

export class PlaygroundController {
  constructor(
    private auth = adminAuthService,
    private service = playgroundService,
    private chat = chatOrchestrationService,
    private limiter = rateLimitService
  ) {}

  private authorized(request: Request) {
    return this.auth.isRequestAuthenticated(request);
  }

  private json(value: unknown, status = 200) {
    return NextResponse.json(value, { status, headers: privateHeaders });
  }

  async list(request: Request) {
    if (!this.authorized(request)) return this.json({ error: "Unauthorized" }, 401);
    try {
      return this.json({ sessions: await this.service.listSessions() });
    } catch {
      return this.json({ error: "ไม่สามารถอ่าน session ได้ ตรวจสอบการเชื่อมต่อฐานข้อมูล" }, 503);
    }
  }

  async read(request: Request, sessionId: string) {
    if (!this.authorized(request)) return this.json({ error: "Unauthorized" }, 401);
    if (!PlaygroundSessionIdSchema.safeParse(sessionId).success) return this.json({ error: "Invalid session" }, 400);
    try {
      const conversation = await this.service.getConversation(sessionId);
      return conversation ? this.json({ conversation }) : this.json({ error: "Session not found" }, 404);
    } catch {
      return this.json({ error: "ไม่สามารถอ่านบทสนทนาได้ ตรวจสอบการเชื่อมต่อฐานข้อมูล" }, 503);
    }
  }

  async send(request: Request) {
    if (!this.authorized(request)) return this.json({ error: "Unauthorized" }, 401);
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
      const reply = await this.chat.createBotReply({ channel: "web", lineUserId, message });
      return this.json({ runId: reply.runId, reply: reply.text });
    } catch {
      // Some failures have a persisted error run. The client reloads the session to inspect it.
      return this.json({ error: "ส่งข้อความไม่สำเร็จ ตรวจสอบ trace และการตั้งค่าฐานข้อมูล/AI ก่อนลองใหม่" }, 503);
    }
  }
}

export const playgroundController = new PlaygroundController();
