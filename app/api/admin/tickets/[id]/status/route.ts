import { NextResponse } from "next/server";
import { ticketStatuses, updateTicketStatus } from "@/lib/ticket";
import type { TicketStatus } from "@/lib/types";

export const runtime = "nodejs";

function isAdminAllowed(formData: FormData, request: Request) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return true;
  }

  const submittedPassword =
    String(formData.get("password") ?? "") || request.headers.get("x-admin-password");

  return submittedPassword === expectedPassword;
}

export async function POST(request: Request, context: any) {
  const formData = await request.formData();

  if (!isAdminAllowed(formData, request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const status = String(formData.get("status") ?? "") as TicketStatus;
  if (!ticketStatuses.includes(status)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported ticket status" },
      { status: 400 }
    );
  }

  const params = await Promise.resolve(context.params);
  await updateTicketStatus(params.id, status);

  const redirectUrl = new URL("/admin/tickets", request.url);
  const password = String(formData.get("password") ?? "");
  if (password) {
    redirectUrl.searchParams.set("password", password);
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
