import { requireAdmin } from "../require-admin";
import { knowledgeAdminService } from "@/src/services/knowledge-admin.service";
import { KnowledgeWorkspace } from "./knowledge-workspace";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  await requireAdmin();
  try {
    return <KnowledgeWorkspace initialData={await knowledgeAdminService.list("", 1)} />;
  } catch {
    return <main className="rounded-2xl border border-amber-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Knowledge Base</h1>
      <p role="alert" className="mt-4 text-sm text-amber-800">ไม่สามารถอ่านคลังความรู้ได้ ตรวจสอบการเชื่อมต่อฐานข้อมูลและ schema แล้วรีเฟรช</p>
      <a href="/admin/knowledge" className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline">ลองใหม่</a>
    </main>;
  }
}
