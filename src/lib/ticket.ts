/**
 * Facade for backward compatibility.
 * Core ticket logic has been refactored to src/services/ticket.service.ts and src/repositories/ticket.repository.ts
 */
export {
  ticketStatuses,
  ticketService,
  formatTicketStatus,
  TicketService
} from "@/src/services/ticket.service";
import { ticketService } from "@/src/services/ticket.service";
import type { TicketDraftDto } from "@/src/dtos/ticket.dto";
import type { ChatSession, TicketStatus } from "@/lib/types";

export type TicketDraft = TicketDraftDto;

export async function parseTicketDraft(message: string) {
  return ticketService.parseTicketDraft(message);
}

export async function getOrCreateChatSession(lineUserId: string) {
  return ticketService.getOrCreateChatSession(lineUserId);
}

export async function resetTicketFlow(lineUserId: string) {
  return ticketService.resetTicketFlow(lineUserId);
}

export async function createTicket(args: {
  lineUserId: string;
  draft: Required<TicketDraft>;
}) {
  return ticketService.createTicket(args);
}

export async function continueTicketFlow(args: {
  lineUserId: string;
  message: string;
  session: ChatSession;
}) {
  return ticketService.continueTicketFlow(args);
}

export async function getTicketByCode(ticketCode: string) {
  return ticketService.getTicketByCode(ticketCode);
}

export async function listTickets() {
  return ticketService.listTickets();
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  return ticketService.updateTicketStatus(id, status);
}

export function formatTicketStatusReply(ticket: Parameters<typeof ticketService.formatTicketStatusReply>[0]) {
  return ticketService.formatTicketStatusReply(ticket);
}
