import { NextResponse } from "next/server";
import { KnowledgeIdSchema, KnowledgeListSchema, KnowledgeSaveSchema, KnowledgeSourceSchema, KnowledgeBulkSchema } from "@/src/dtos/knowledge-admin.dto";
import { adminAuthService } from "@/src/services/admin-auth.service";
import { KnowledgeAdminError, knowledgeAdminService } from "@/src/services/knowledge-admin.service";
import { isSameOrigin } from "./admin-auth.controller";

export class KnowledgeAdminController {
  constructor(private service = knowledgeAdminService, private auth = adminAuthService) {}

  private json(value: unknown, status = 200) {
    return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
  }

  private guard(request: Request, write = false) {
    if (!this.auth.isRequestAuthenticated(request)) return this.json({ error: "Unauthorized" }, 401);
    if (write && !isSameOrigin(request)) return this.json({ error: "Forbidden" }, 403);
  }

  private failure(error: unknown) {
    return error instanceof KnowledgeAdminError ? this.json({ error: error.message }, error.status)
      : this.json({ error: "ดำเนินการไม่สำเร็จ ตรวจสอบการเชื่อมต่อฐานข้อมูล แหล่งอ้างอิง และการตั้งค่า AI แล้วลองใหม่" }, 503);
  }

  async list(request: Request) {
    const denied = this.guard(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const parsed = KnowledgeListSchema.safeParse({ search: params.get("search") ?? "", page: params.get("page") ?? 1,
      category: params.get("category") ?? "", status: params.get("status") ?? "all", source: params.get("source") ?? "all", limit: params.get("limit") ?? 10 });
    if (!parsed.success) return this.json({ error: "คำค้นหรือเลขหน้าไม่ถูกต้อง" }, 400);
    try { return this.json(await this.service.list(parsed.data.search, parsed.data.page, parsed.data)); }
    catch (error) { return this.failure(error); }
  }

  async save(request: Request) {
    const denied = this.guard(request, true);
    if (denied) return denied;
    let body: unknown;
    try { body = await request.json(); } catch { return this.json({ error: "Invalid JSON" }, 400); }
    const parsed = KnowledgeSaveSchema.safeParse(body);
    if (!parsed.success) return this.json({ error: "ข้อมูลบทความไม่ถูกต้อง ตรวจสอบแหล่งอ้างอิง ผู้ตรวจทาน และลำดับวันที่", issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, 400);
    try { return this.json(await this.service.save(parsed.data)); }
    catch (error) { return this.failure(error); }
  }

  async read(request: Request, id: string) {
    const denied = this.guard(request);
    if (denied) return denied;
    if (!KnowledgeIdSchema.safeParse(id).success) return this.json({ error: "Invalid document ID" }, 400);
    try { return this.json(await this.service.read(id)); }
    catch (error) { return this.failure(error); }
  }

  async bulk(request: Request) {
    const denied = this.guard(request, true);
    if (denied) return denied;
    let body: unknown;
    try { body = await request.json(); } catch { return this.json({ error: "Invalid JSON" }, 400); }
    const parsed = KnowledgeBulkSchema.safeParse(body);
    if (!parsed.success) return this.json({ error: "เลือกบทความไม่ซ้ำ 1–50 รายการ พร้อมข้อมูลล่าสุด และระบุหมวดหมู่หรือคำค้นที่ต้องการเปลี่ยน" }, 400);
    try { return this.json(await this.service.bulk(parsed.data)); }
    catch (error) { return this.failure(error); }
  }

  async snapshot(request: Request) {
    const denied = this.guard(request, true);
    if (denied) return denied;
    let body: unknown;
    try { body = await request.json(); } catch { return this.json({ error: "Invalid JSON" }, 400); }
    const parsed = KnowledgeSourceSchema.safeParse(body);
    if (!parsed.success) return this.json({ error: "ใช้ URL แบบ HTTPS ของ bu.ac.th หรือโดเมนย่อยเท่านั้น" }, 400);
    try { return this.json(await this.service.snapshot(parsed.data.sourceUrl)); }
    catch (error) { return this.failure(error); }
  }

  async check(request: Request, id: string) {
    const denied = this.guard(request, true);
    if (denied) return denied;
    if (!KnowledgeIdSchema.safeParse(id).success) return this.json({ error: "Invalid document ID" }, 400);
    try { return this.json({ result: await this.service.check(id) }); }
    catch (error) { return this.failure(error); }
  }
}

export const knowledgeAdminController = new KnowledgeAdminController();
