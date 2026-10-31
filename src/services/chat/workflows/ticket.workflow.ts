import { extractTicketCode } from "@/src/lib/router/intent";
import type { ChatSession } from "@/src/lib/types";
import type { TicketService } from "@/src/services/ticket.service";
import { formatTicketResetReply, ticketCodeRequiredReply, formatTicketNotFoundReply } from "@/src/presenters/chat-workflow.presenter";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply, ResolvedRoute } from "../chat-contracts";
import { asReply } from "../chat-reply";

export async function executeTicketWorkflow({
  route, lineUserId, trimmedMessage, session, isThai, executionLog
}: {
  route: ResolvedRoute;
  lineUserId: string;
  trimmedMessage: string;
  session: ChatSession;
  isThai: boolean;
  executionLog: ExecutionLogEntry[];
}, ticketSvc: TicketService): Promise<BotReply> {
  const { intent } = route;
  let reply: BotReply;
  if (route.resetRequested) {
    executionLog.push({ action: "Reset Ticket Flow" });
    await ticketSvc.resetTicketFlow(lineUserId);
    reply = asReply(
      formatTicketResetReply(isThai),
      undefined,
      undefined,
      undefined,
      undefined,
      executionLog
    );
  } else if (intent === "CREATE_TICKET") {
    executionLog.push({ action: "Continue Ticket Flow" });
    const ticketReply = await ticketSvc.continueTicketFlow({
      lineUserId,
      message: trimmedMessage,
      session
    });
    reply = asReply(
      ticketReply.text,
      undefined,
      undefined,
      undefined,
      ticketReply.flexMessage,
      executionLog
    );
  } else {
    executionLog.push({ action: "Check Ticket Status" });
    const ticketCode = extractTicketCode(trimmedMessage);
    if (!ticketCode) {
      executionLog.push({ action: "Parse Ticket Code", details: "Missing ticket code" });
      reply = asReply(
        ticketCodeRequiredReply,
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else {
      executionLog.push({ action: "Get Ticket by Code", details: `Code: ${ticketCode}` });
      const ticket = await ticketSvc.getTicketByCode(ticketCode);
      reply = asReply(
        ticket ? ticketSvc.formatTicketStatusReply(ticket) : formatTicketNotFoundReply(ticketCode),
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    }
  }
  return reply;
}
