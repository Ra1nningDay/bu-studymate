import Link from "next/link";
import { Suspense } from "react";
import { adminOverviewService, type AdminOverview } from "@/src/services/admin-overview.service";
import type { OverviewCorpusCounts } from "@/src/repositories/admin-overview.repository";
import { requireAdmin } from "./require-admin";
import { ConversationChart, IntentChart } from "./overview-charts";
import { AdminPageHeader } from "./admin-page-header";
import { DateRangeFilter } from "./date-range-filter";
import { analyticsDateRange, type AnalyticsDateRange, type AnalyticsSearchParams } from "@/lib/analytics-date-range";

export const dynamic = "force-dynamic";
const panel = "rounded-lg border border-slate-200 bg-white p-5";
const pulseBlock = "rounded-md bg-slate-100 motion-safe:animate-pulse";

function KnowledgeSnapshotPanel({ counts }: { counts: OverviewCorpusCounts }) {
  return (
    <section className={panel}>
      <h2 className="text-base font-semibold">Knowledge Snapshot</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">ข้อมูลที่บันทึก ณ ตอนนี้</p>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        <div className="flex items-center justify-between gap-4 py-3"><dt className="text-slate-600">BU Knowledge Items</dt><dd className="font-semibold">{counts.knowledgeItems.toLocaleString()}</dd></div>
        <div className="flex items-center justify-between gap-4 py-3"><dt className="text-slate-600">Study Materials</dt><dd className="font-semibold">{counts.studyMaterials.toLocaleString()}</dd></div>
        <div className="flex items-center justify-between gap-4 py-3"><dt className="text-slate-600">Study Material Chunks</dt><dd className="font-semibold">{counts.chunks.toLocaleString()}</dd></div>
      </dl>
      <p className="mt-3 text-sm leading-6 text-slate-600">ยังไม่มีข้อมูลสถานะ processing/failed ของแหล่งความรู้ และยังไม่ได้วัด Resolution Rate</p>
    </section>
  );
}

function KnowledgeSnapshotSkeleton() {
  return (
    <section aria-busy="true" className={panel}>
      <h2 className="text-base font-semibold">Knowledge Snapshot</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">ข้อมูลที่บันทึก ณ ตอนนี้</p>
      <div className="mt-4 space-y-3 py-1" aria-hidden="true">
        <div className={`${pulseBlock} h-5 w-full`} />
        <div className={`${pulseBlock} h-5 w-full`} />
        <div className={`${pulseBlock} h-5 w-full`} />
      </div>
    </section>
  );
}

async function KnowledgeSnapshotStream({ fallbackCounts }: { fallbackCounts?: OverviewCorpusCounts }) {
  try {
    const counts = typeof adminOverviewService.readCorpusSnapshot === "function"
      ? await adminOverviewService.readCorpusSnapshot()
      : fallbackCounts;
    if (!counts) throw new Error("missing corpus counts");
    return <KnowledgeSnapshotPanel counts={counts} />;
  } catch {
    if (fallbackCounts) return <KnowledgeSnapshotPanel counts={fallbackCounts} />;
    return (
      <section className={panel}>
        <h2 className="text-base font-semibold">Knowledge Snapshot</h2>
        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          อ่านจำนวนฐานความรู้ไม่สำเร็จชั่วคราว
        </p>
      </section>
    );
  }
}

function OverviewBodyFallback({ range }: { range: AnalyticsDateRange }) {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-live="polite">
      <AdminPageHeader
        title="Overview"
        description={`${range.from} – ${range.to} · กำลังโหลดข้อมูลบทสนทนาและการทำงานของบอท…`}
        actions={
          <div className="text-left text-xs leading-5 text-slate-600 sm:text-right">
            <p className="font-semibold">{range.days} วัน · เวลาไทย</p>
          </div>
        }
      />
      <DateRangeFilter {...range} action="/admin" />
      <section aria-label="Overview metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index} className="space-y-3 bg-white p-5" aria-hidden="true">
            <div className={`${pulseBlock} h-4 w-28`} />
            <div className={`${pulseBlock} h-7 w-20`} />
            <div className={`${pulseBlock} h-4 w-36`} />
          </article>
        ))}
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]" aria-hidden="true">
        <div className="min-w-0 space-y-4">
          <div className={`${panel} h-64 ${pulseBlock}`} />
          <div className={`${panel} h-48 ${pulseBlock}`} />
        </div>
        <div className="min-w-0 space-y-4">
          <div className={`${panel} h-56 ${pulseBlock}`} />
          <KnowledgeSnapshotSkeleton />
        </div>
      </div>
    </div>
  );
}

async function OverviewBody({ range }: { range: AnalyticsDateRange }) {
  const dateFilter = <DateRangeFilter {...range} action="/admin" />;
  const runsHref = `/admin/runs?${new URLSearchParams({ from: range.from, to: range.to })}`;
  const failuresHref = `${runsHref}&status=error`;
  let data: AdminOverview;
  try {
    data = await adminOverviewService.read(new Date(), range);
  } catch {
    return (
      <section className="space-y-4">
        <AdminPageHeader
          title="Overview"
          description="ภาพรวมบทสนทนา การทำงานของบอท และรายการที่ต้องตรวจสอบ"
        />
        {dateFilter}
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          อ่านข้อมูล Overview ไม่สำเร็จ ตรวจสอบการเชื่อมต่อและ schema ของฐานข้อมูล แล้วโหลดหน้านี้ใหม่
        </p>
      </section>
    );
  }
  const metrics = [
    { label: "Total Conversations", value: data.totalConversations.toLocaleString(), note: "Identity ที่ส่งข้อความในช่วงที่เลือก" },
    { label: "Successful Runs", value: data.successRate === null ? "—" : `${data.successRate.toFixed(1)}%`, note: `${data.successfulRuns}/${data.totalRuns} runs สำเร็จ · ไม่ใช่อัตราแก้ปัญหา` },
    { label: "Avg Response Time", value: data.averageLatencyMs === null ? "—" : `${(data.averageLatencyMs / 1000).toFixed(2)}s`, note: "เฉพาะ success runs ที่บันทึก latency" },
    { label: "Open Tickets", value: data.openTickets.toLocaleString(), note: "PENDING + IN_PROGRESS ณ ตอนนี้" }
  ];
  const attention = [
    ...data.tickets.map((ticket) => ({ id: ticket.id, type: "Open Ticket", title: `${ticket.ticketCode} · ${ticket.description}`, status: ticket.status, date: ticket.updatedAt, href: "/admin/tickets" })),
    ...data.failures.map((run) => ({ id: run.id, type: "Failed Run", title: `${run.intent ?? "ยังไม่ระบุ intent"} · ${run.errorCode ?? "ไม่มี error code"}`, status: "error", date: run.createdAt, href: failuresHref }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const fallbackCounts: OverviewCorpusCounts | undefined =
    typeof data.knowledgeItems === "number"
      ? { knowledgeItems: data.knowledgeItems, studyMaterials: data.studyMaterials, chunks: data.chunks }
      : undefined;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Overview"
        description={`${range.from} – ${range.to} · ${data.totalRuns.toLocaleString()} runs · ${data.errorRuns.toLocaleString()} failed · ${data.openTickets.toLocaleString()} tickets ที่ยังเปิดอยู่`}
        actions={
          <div className="text-left text-xs leading-5 text-slate-600 sm:text-right">
            <p className="font-semibold">{range.days} วัน · เวลาไทย</p>
            <p className="text-slate-600">
              อ่านข้อมูลเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(data.generatedAt))}
            </p>
          </div>
        }
      />
      {dateFilter}
      <section aria-label="Overview metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-white p-5">
            <h2 className="text-sm text-slate-600">{metric.label}</h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{metric.note}</p>
          </article>
        ))}
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-4">
          <section className={panel}>
            <h2 className="text-base font-semibold">Conversation Trends</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">ผู้สนทนารายวัน · LINE และ Web รวมกัน</p>
            <ConversationChart days={data.days} />
          </section>
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Needs Attention</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Open tickets ณ ตอนนี้สูงสุด 5 รายการ และ failed runs ในช่วงที่เลือกสูงสุด 5 รายการ</p>
              </div>
              <Link href={data.errorRuns ? failuresHref : "/admin/tickets"} className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 hover:underline focus-visible:outline-emerald-700">{data.errorRuns ? "ตรวจสอบ failed runs →" : "ดู tickets →"}</Link>
            </div>
            {attention.length ? <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-slate-600">
                  <tr>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Title / Issue</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap p-3">{item.type}</td>
                      <td className="max-w-lg p-3">
                        <Link href={item.href} className="break-words text-emerald-800 hover:underline">{item.title}</Link>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-md px-2 py-1 ${item.status === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-3 text-slate-600">
                        {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(item.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> : <p className="mt-4 py-3 text-sm leading-6 text-slate-600">ไม่มีรายการที่ต้องตรวจสอบในข้อมูลที่อ่านได้</p>}
          </section>
        </div>
        <div className="min-w-0 space-y-4">
          <section className={panel}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Top Intents</h2>
              <Link href={runsHref} className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 hover:underline focus-visible:outline-emerald-700">ดู runs →</Link>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">Intent ที่บันทึกจาก runs ในช่วงเดียวกัน</p>
            <IntentChart intents={data.topIntents} total={data.totalRuns} />
          </section>
          <Suspense fallback={<KnowledgeSnapshotSkeleton />}>
            <KnowledgeSnapshotStream fallbackCounts={fallbackCounts} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  await requireAdmin();
  const range = analyticsDateRange(await searchParams);
  if (range.error) {
    return (
      <section className="space-y-4">
        <AdminPageHeader title="Overview" description="ภาพรวมบทสนทนาและการทำงานของบอท" />
        <DateRangeFilter {...range} action="/admin" />
        <p role="alert">{range.error}</p>
      </section>
    );
  }
  return (
    <Suspense key={`${range.from}:${range.to}`} fallback={<OverviewBodyFallback range={range} />}>
      <OverviewBody range={range} />
    </Suspense>
  );
}
