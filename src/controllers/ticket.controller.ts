import { NextResponse } from "next/server";
import {
  ticketService,
  type TicketService
} from "@/src/services/ticket.service";
import {
  UpdateTicketStatusSchema,
  type TicketStatusDto
} from "@/src/dtos/ticket.dto";

import { adminAuthService } from "@/src/services/admin-auth.service";
import { accessDenied, getPublicOrigin, isSameOrigin } from "@/src/controllers/admin-auth.controller";

export class TicketController {
  constructor(private ticketSvc: TicketService = ticketService, private auth = adminAuthService) {}

  async handleUpdateStatus(request: Request, context: any): Promise<NextResponse> {
    const access = await this.auth.authorize(request, "write");
    if (access !== "ok") {
      const { error, status } = accessDenied(access);
      return NextResponse.json({ ok: false, error }, { status });
    }
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    let formData: FormData;
    try { formData = await request.formData(); }
    catch { return NextResponse.json({ ok: false, error: "Invalid form" }, { status: 400 }); }

    const rawStatus = String(formData.get("status") ?? "");
    const parseResult = UpdateTicketStatusSchema.safeParse({
      status: rawStatus
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { ok: false, error: "Unsupported ticket status" },
        { status: 400 }
      );
    }

    const params = await Promise.resolve(context.params);
    try { await this.ticketSvc.updateTicketStatus(params.id, parseResult.data.status as TicketStatusDto); }
    catch { return NextResponse.json({ ok: false, error: "Unable to update ticket" }, { status: 503 }); }
    return NextResponse.redirect(new URL("/admin/tickets", getPublicOrigin(request)), { status: 303 });
  }

  async listTickets() {
    return this.ticketSvc.listTickets();
  }
}

export const ticketController = new TicketController();
