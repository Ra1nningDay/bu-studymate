import { NextResponse } from "next/server";
import {
  ticketService,
  type TicketService
} from "@/src/services/ticket.service";
import {
  UpdateTicketStatusSchema,
  type TicketStatusDto
} from "@/src/dtos/ticket.dto";

import { env } from "@/src/config/env";

function isAdminAllowed(formData: FormData, request: Request) {
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return true;
  }

  const submittedPassword =
    String(formData.get("password") ?? "") || request.headers.get("x-admin-password");

  return submittedPassword === expectedPassword;
}

export class TicketController {
  constructor(private ticketSvc: TicketService = ticketService) {}

  async handleUpdateStatus(request: Request, context: any): Promise<NextResponse> {
    const formData = await request.formData();

    if (!isAdminAllowed(formData, request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawStatus = String(formData.get("status") ?? "");
    const parseResult = UpdateTicketStatusSchema.safeParse({
      status: rawStatus,
      password: String(formData.get("password") ?? "")
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { ok: false, error: "Unsupported ticket status" },
        { status: 400 }
      );
    }

    const params = await Promise.resolve(context.params);
    await this.ticketSvc.updateTicketStatus(params.id, parseResult.data.status as TicketStatusDto);

    const redirectUrl = new URL("/admin/tickets", request.url);
    const password = String(formData.get("password") ?? "");
    if (password) {
      redirectUrl.searchParams.set("password", password);
    }

    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  async listTickets() {
    return this.ticketSvc.listTickets();
  }
}

export const ticketController = new TicketController();
