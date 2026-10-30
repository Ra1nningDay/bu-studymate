import Link from "next/link";
import { adminOverviewService } from "@/src/services/admin-overview.service";
import { requireAdmin } from "./require-admin";
import { ConversationChart, IntentChart } from "./overview-charts";

export const dynamic = "force-dynamic";
const panel = "rounded-xl border border-emerald-100/80 bg-white p-5 shadow-sm shadow-emerald-900/[.02]";

export default async function OverviewPage() {
  await requireAdmin();
  let data;
  try { data = await adminOverviewService.read(); }
  catch {
    return <section><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Admin Dashboard</p><h1 className="mt-2 text-3xl font-bold">BU StudyMate Overview</h1><p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">อ่านข้อมูล Overview ไม่สำเร็จ ตรวจสอบการเชื่อมต่อและ schema ของฐานข้อมูล แล้วโหลดหน้านี้ใหม่</p></section>;
  }
  const metrics = [
    { label: "Total Conversations", value: data.totalConversations.toLocaleString(), note: "Identity ที่ส่งข้อความในช่วง 7 วัน", symbol: "◌" },
    { label: "Successful Runs", value: data.successRate === null ? "—" : `${data.successRate.toFixed(1)}%`, note: `${data.successfulRuns}/${data.totalRuns} runs สำเร็จ · ไม่ใช่อัตราแก้ปัญหา`, symbol: "✓" },
    { label: "Avg Response Time", value: data.averageLatencyMs === null ? "—" : `${(data.averageLatencyMs / 1000).toFixed(2)}s`, note: "เวลารวมเฉพาะ success runs ที่บันทึก latency", symbol: "◷" },
    { label: "Open Tickets", value: data.openTickets.toLocaleString(), note: "PENDING + IN_PROGRESS ทั้งหมด ณ ตอนนี้", symbol: "▤" }
  ];
  const attention = [
    ...data.tickets.map((ticket) => ({ id: ticket.id, type: "Open Ticket", title: `${ticket.ticketCode} · ${ticket.description}`, status: ticket.status, date: ticket.updatedAt, href: "/admin/tickets" })),
    ...data.failures.map((run) => ({ id: run.id, type: "Failed Run", title: `${run.intent ?? "ยังไม่ระบุ intent"} · ${run.errorCode ?? "ไม่มี error code"}`, status: "error", date: run.createdAt, href: "/admin/runs?status=error" }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-5 rounded-xl bg-gradient-to-r from-transparent to-emerald-100/60 py-2">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Admin Dashboard</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">BU StudyMate Overview</h1><p className="mt-2 text-sm text-slate-500">ภาพรวมบทสนทนา การทำงานของบอท และรายการที่ต้องตรวจสอบ</p></div>
      <div className="pr-5 text-right text-xs leading-6 text-emerald-800"><p className="font-semibold">7 วันรวมวันนี้ · เวลาไทย</p><p>อ่านข้อมูลเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(data.generatedAt))}</p></div>
    </header>
    <section aria-label="Overview metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => <article key={metric.label} className={`${panel} flex items-start gap-4`}><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl text-emerald-600">{metric.symbol}</span><div><h2 className="text-sm text-slate-600">{metric.label}</h2><p className="mt-1 text-3xl font-bold tracking-tight">{metric.value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{metric.note}</p></div></article>)}
    </section>
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section className={panel}><h2 className="text-lg font-bold">Conversation Trends</h2><p className="mt-1 text-xs text-slate-500">ผู้สนทนารายวัน · LINE และ Web รวมกัน</p><ConversationChart days={data.days} /></section>
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Top Intents</h2><Link href="/admin/runs" className="text-xs font-semibold text-emerald-700">ดู runs →</Link></div><p className="mt-1 text-xs text-slate-500">Intent ที่บันทึกจาก runs ในช่วงเดียวกัน</p><IntentChart intents={data.topIntents} total={data.totalRuns} /></section>
    </div>
    <section className={panel}><h2 className="text-lg font-bold">Knowledge Snapshot</h2><p className="mt-1 text-xs text-slate-500">จำนวนข้อมูลที่บันทึกอยู่ในฐานข้อมูล ณ ตอนนี้</p><dl className="mt-5 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-slate-500">BU Knowledge Items</dt><dd className="mt-1 text-2xl font-bold">{data.knowledgeItems.toLocaleString()}</dd></div><div><dt className="text-xs text-slate-500">Study Materials</dt><dd className="mt-1 text-2xl font-bold">{data.studyMaterials.toLocaleString()}</dd></div><div><dt className="text-xs text-slate-500">Study Material Chunks</dt><dd className="mt-1 text-2xl font-bold">{data.chunks.toLocaleString()}</dd></div></dl><p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-slate-600">ยังไม่มีข้อมูลสถานะ processing/failed ของแหล่งความรู้ และยังไม่ได้วัด Resolution Rate</p></section>
    <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Needs Attention</h2><p className="mt-1 text-xs text-slate-500">Open tickets ล่าสุดสูงสุด 5 รายการ และ failed runs ล่าสุดสูงสุด 5 รายการในช่วง 7 วัน</p></div><span className="text-xs font-medium text-rose-700">{data.errorRuns} failed runs ในช่วงนี้</span></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Title / Issue</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Updated</th></tr></thead><tbody>{attention.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="whitespace-nowrap p-3">{item.type}</td><td className="max-w-lg p-3"><Link href={item.href} className="break-words text-emerald-800 hover:underline">{item.title}</Link></td><td className="p-3"><span className={`rounded-md px-2 py-1 ${item.status === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{item.status}</span></td><td className="whitespace-nowrap p-3 text-slate-500">{new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(item.date)}</td></tr>)}{!attention.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">ไม่มีรายการที่ต้องตรวจสอบในข้อมูลที่อ่านได้</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
