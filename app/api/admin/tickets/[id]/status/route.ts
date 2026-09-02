import { ticketController } from "@/src/controllers/ticket.controller";

export const runtime = "nodejs";

export async function POST(request: Request, context: any) {
  return ticketController.handleUpdateStatus(request, context);
}
