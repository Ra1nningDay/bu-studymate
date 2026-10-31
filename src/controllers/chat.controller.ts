import { NextResponse } from "next/server";
import { isAiConfigured } from "@/src/lib/ai/config";
import {
  ChatRequestSchema,
  type ChatResponseDto
} from "@/src/dtos/chat.dto";
import {
  chatOrchestrationService,
  type ChatOrchestrationService
} from "@/src/services/chat/chat-orchestration.service";
import {
  rateLimitService,
  messageRateLimitConfig,
  fileUploadRateLimitConfig,
  type RateLimitService
} from "@/src/services/rate-limit.service";
import {
  chatResponsePresenter,
  type ChatResponsePresenter
} from "@/src/presenters/chat-response.presenter";
import { createSseChatResponse, wantsEventStream } from "@/src/presenters/chat-stream.presenter";
import { normalizeWebSessionId } from "@/lib/web-session";
import { saveStudyFile } from "@/src/lib/study/study-file";
import { adminAuthService } from "@/src/services/admin-auth.service";
import { accessDenied, isSameOrigin } from "@/src/controllers/admin-auth.controller";
import { ticketService, type TicketService } from "@/src/services/ticket.service";
import { handleApiError } from "@/src/errors";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : null;
}

export class ChatController {
  constructor(
    private chatSvc: ChatOrchestrationService = chatOrchestrationService,
    private rateLimitSvc: RateLimitService = rateLimitService,
    private presenter: ChatResponsePresenter = chatResponsePresenter,
    private auth = adminAuthService,
    private ticketSvc: TicketService = ticketService,
    private saveFile = saveStudyFile
  ) {}

  async handleWebChat(request: Request): Promise<NextResponse> {
    const access = await this.auth.authorize(request, "write");
    if (access !== "ok") {
      const { error, status } = accessDenied(access);
      return NextResponse.json({ error }, { status });
    }
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let bodyRaw: unknown;

    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = ChatRequestSchema.safeParse(bodyRaw);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues[0]?.message || "Invalid chat request";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { message, sessionId } = parseResult.data;
    const lineUserId = normalizeWebSessionId(sessionId);

    const rateLimit = await this.rateLimitSvc.consume({
      lineUserId,
      ...messageRateLimitConfig
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        this.presenter.formatRateLimitError(rateLimit),
        { status: 429 }
      );
    }

    if (wantsEventStream(request)) {
      return createSseChatResponse({
        errorMessage: "ไม่สามารถสร้างคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        execute: (stream) =>
          this.chatSvc.createBotReply({
            channel: "web",
            lineUserId,
            message,
            stream
          }),
        formatDone: (reply) => ({
          ...this.presenter.formatWebChatSuccess({
            aiConfigured: isAiConfigured(),
            reply: reply.text,
            flexMessage: reply.flexMessage,
            sources: reply.sources ?? [],
            usedWebSearch: Boolean(reply.usedWebSearch),
            quickReply: reply.quickReply
          }),
          runId: reply.runId ?? null
        })
      });
    }

    const reply = await this.chatSvc.createBotReply({
      channel: "web",
      lineUserId,
      message
    });

    const responseDto: ChatResponseDto = this.presenter.formatWebChatSuccess({
      aiConfigured: isAiConfigured(),
      reply: reply.text,
      flexMessage: reply.flexMessage,
      sources: reply.sources ?? [],
      usedWebSearch: Boolean(reply.usedWebSearch),
      quickReply: reply.quickReply
    });

    return NextResponse.json(responseDto);
  }

  async handleStudyUpload(request: Request): Promise<NextResponse> {
    const access = await this.auth.authorize(request, "write");
    if (access !== "ok") {
      const { error, status } = accessDenied(access);
      return NextResponse.json({ error }, { status });
    }
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart form body" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const lineUserId = normalizeWebSessionId(getFormString(formData, "sessionId"));
    const rateLimit = await this.rateLimitSvc.consume({
      lineUserId,
      ...fileUploadRateLimitConfig
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        this.presenter.formatRateLimitError(rateLimit),
        { status: 429 }
      );
    }

    try {
      await this.ticketSvc.getOrCreateChatSession(lineUserId);
      const savedFile = await this.saveFile({
        buffer: Buffer.from(await file.arrayBuffer()),
        courseName: getFormString(formData, "courseName"),
        fileName: file.name,
        lineUserId,
        mimeType: file.type
      });

      return NextResponse.json({
        aiConfigured: isAiConfigured(),
        fileName: savedFile.fileName,
        note: savedFile.note,
        pageCount: savedFile.pageCount,
        sourceType: savedFile.sourceType,
        usedOcr: savedFile.usedOcr,
        warnings: savedFile.warnings
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const chatController = new ChatController();
