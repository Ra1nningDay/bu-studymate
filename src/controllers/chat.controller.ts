import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai";
import {
  ChatRequestSchema,
  type ChatResponseDto
} from "@/src/dtos/chat.dto";
import {
  chatOrchestrationService,
  type ChatOrchestrationService
} from "@/src/services/chat-orchestration.service";
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
import { normalizeWebSessionId } from "@/lib/web-session";
import { saveStudyFile } from "@/lib/study-file";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : null;
}

export class ChatController {
  constructor(
    private chatSvc: ChatOrchestrationService = chatOrchestrationService,
    private rateLimitSvc: RateLimitService = rateLimitService,
    private presenter: ChatResponsePresenter = chatResponsePresenter
  ) {}

  async handleWebChat(request: Request): Promise<NextResponse> {
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
      usedWebSearch: Boolean(reply.usedWebSearch)
    });

    return NextResponse.json(responseDto);
  }

  async handleStudyUpload(request: Request): Promise<NextResponse> {
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
      const savedFile = await saveStudyFile({
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
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to save study file" },
        { status: 400 }
      );
    }
  }
}

export const chatController = new ChatController();
