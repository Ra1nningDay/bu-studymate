import { playgroundRepository, type PlaygroundRepository } from "@/src/repositories/playground.repository";
import { presentPlaygroundConversation, presentPlaygroundSession } from "@/src/presenters/playground.presenter";
import { PlaygroundSessionIdSchema } from "@/src/dtos/playground.dto";

export class PlaygroundService {
  constructor(private repository: PlaygroundRepository = playgroundRepository) {}

  async listSessions() {
    return (await this.repository.listSessions()).map(presentPlaygroundSession)
      .filter((session) => PlaygroundSessionIdSchema.safeParse(session.sessionId).success);
  }

  async getConversation(sessionId: string) {
    // Never allow a LINE identity or an ordinary web session through this boundary.
    PlaygroundSessionIdSchema.parse(sessionId);
    const data = await this.repository.getConversation(sessionId);
    return data ? presentPlaygroundConversation(data) : null;
  }
}

export const playgroundService = new PlaygroundService();
