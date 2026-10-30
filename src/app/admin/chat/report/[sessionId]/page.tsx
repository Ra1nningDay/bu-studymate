import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaygroundSessionIdSchema } from "@/src/dtos/playground.dto";
import { requireAdmin } from "../../../require-admin";
import { playgroundService } from "@/src/services/playground.service";
import {
  presentConversationReport,
  getSampleEddiReportFixture
} from "@/src/presenters/report.presenter";
import { ReportView } from "./report-view";

export const dynamic = "force-dynamic";

export default async function PlaygroundReport({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireAdmin();
  const { sessionId } = await params;

  // If viewing the sample/fixture session requested by user
  if (
    sessionId === "sess-local-01-EDDI-ALL-mv1ayhvs1" ||
    sessionId.startsWith("sess-local-") ||
    sessionId === "sample-eddi"
  ) {
    const reportData = getSampleEddiReportFixture();
    return <ReportView report={reportData} />;
  }

  if (!PlaygroundSessionIdSchema.safeParse(sessionId).success) notFound();

  let conversation;
  try {
    conversation = await playgroundService.getConversation(sessionId);
  } catch {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">อ่านรายงานไม่สำเร็จ</h1>
        <p className="mt-4 text-slate-600">ตรวจสอบการเชื่อมต่อฐานข้อมูล แล้วเปิดรายงานใหม่</p>
        <Link href="/admin/chat" className="mt-4 inline-block font-semibold text-emerald-700 underline">
          กลับ Web Chat
        </Link>
      </main>
    );
  }

  if (!conversation) notFound();

  const reportData = presentConversationReport(conversation);
  return <ReportView report={reportData} />;
}
