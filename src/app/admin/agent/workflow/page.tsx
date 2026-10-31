import Link from "next/link";
import { requireAdmin } from "../../require-admin";
import { AdminPageHeader } from "../../admin-page-header";
import { DateRangeFilter } from "../../date-range-filter";
import { analyticsDateRange } from "@/lib/analytics-date-range";
import { listBotRunReviews, type BotRunReviewFilters } from "@/lib/bot-run-review";
import { WorkflowWorkspace } from "./workflow-workspace";
import "@xyflow/react/dist/style.css";
import "./workflow.css";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const value = (key: string) => Array.isArray(params[key]) ? params[key][0] : params[key];
  const range = analyticsDateRange(params);
  const serverFilters = Object.fromEntries(
    ["channel", "intent", "status", "target", "usedWebSearch"].map(key => [key, value(key)])
  );
  const filters: BotRunReviewFilters = { from: range.from, to: range.to, ...serverFilters };
  const requestedPage = Number(value("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let data: Awaited<ReturnType<typeof listBotRunReviews>> = { items: [], totalCount: 0 };
  let error = range.error;
  if (!error) {
    try {
      data = await listBotRunReviews(filters, page, 12);
    } catch {
      error = "โหลด Bot Runs ไม่สำเร็จ กรุณาลองใหม่หรือตรวจสอบการเชื่อมต่อฐานข้อมูล";
    }
  }

  return <main className="min-w-0 space-y-5">
    <AdminPageHeader title="Agent Workflow" description="เส้นทางของคำถามและหลักฐานจากการทำงานที่บันทึกไว้"
      actions={<Link href="/admin/chat" className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-emerald-700">ทดสอบใน Web Chat</Link>} />
    <DateRangeFilter {...range} action="/admin/agent/workflow" preservedFilters={serverFilters} />
    <WorkflowWorkspace key={JSON.stringify([filters, page, value("run")])} {...data} filters={filters}
      page={page} initialRunId={value("run")} error={error} />
  </main>;
}
