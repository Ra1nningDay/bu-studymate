import { AppError } from "@/src/errors";

export class InvalidTicketStatusError extends AppError {
  readonly statusCode = 400;
  readonly code = "TICKET_INVALID_STATUS";

  constructor(status: string) {
    super("Unsupported ticket status", true, { status });
  }
}

export class TicketNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "TICKET_NOT_FOUND";

  constructor(ticketIdOrCode: string) {
    super(`Ticket not found: ${ticketIdOrCode}`, true, { ticketIdOrCode });
  }
}
