import { NextResponse } from "next/server";
import { adminAuthService } from "@/src/services/admin-auth.service";
import { accessDenied, getPublicOrigin, isSameOrigin } from "@/src/controllers/admin-auth.controller";
import { studentAccountRepository, type StudentAccountRepository } from "@/src/repositories/student-account.repository";

export class StudentAdminController {
  constructor(
    private repo: Pick<StudentAccountRepository, "remove"> = studentAccountRepository,
    private auth = adminAuthService
  ) {}

  async handleDelete(request: Request): Promise<NextResponse> {
    const access = await this.auth.authorize(request, "write");
    if (access !== "ok") {
      const { error, status } = accessDenied(access);
      return NextResponse.json({ ok: false, error }, { status });
    }
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ ok: false, error: "Invalid form" }, { status: 400 }); }

    const lineUserId = String(form.get("lineUserId") ?? "");
    const confirmEmail = String(form.get("confirmEmail") ?? "");
    if (!lineUserId || !confirmEmail) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });

    let result;
    try { result = await this.repo.remove({ lineUserId, confirmEmail }); }
    catch { return NextResponse.json({ ok: false, error: "Unable to delete user" }, { status: 503 }); }
    if (result === "not_found") return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    if (result === "mismatch") return NextResponse.json({ ok: false, error: "Email does not match" }, { status: 400 });
    return NextResponse.redirect(new URL("/admin/users", getPublicOrigin(request)), { status: 303 });
  }
}

export const studentAdminController = new StudentAdminController();
