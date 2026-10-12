import { prisma } from "@/lib/prisma";
import { normalizeWebSessionId } from "@/lib/web-session";

export const playgroundUserPrefix = "web-chat-playground-";

export class PlaygroundRepository {
  async listSessions() {
    return prisma.chatSession.findMany({
      where: { lineUserId: { startsWith: playgroundUserPrefix } },
      select: { lineUserId: true, createdAt: true, state: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async getConversation(sessionId: string) {
    const lineUserId = normalizeWebSessionId(sessionId);
    const session = await prisma.chatSession.findUnique({ where: { lineUserId } });
    if (!session) return null;
    const [messages, runs] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { lineUserId, channel: "web" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }),
      prisma.botRun.findMany({
        where: { lineUserId, metadata: { path: ["channel"], equals: "web" } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      })
    ]);
    return { session, messages, runs };
  }
}

export const playgroundRepository = new PlaygroundRepository();
