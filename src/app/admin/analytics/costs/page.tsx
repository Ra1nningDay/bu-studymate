import { requireAdmin } from "../../require-admin";
import { analyticsCostService } from "@/src/services/analytics-cost.service";
import { analyticsDateRange, type AnalyticsSearchParams } from "@/lib/analytics-date-range";
import { USD_TO_THB_RATE } from "@/src/config/pricing.config";
import { AdminPageHeader } from "../../admin-page-header";
import { DateRangeFilter } from "../../date-range-filter";

export const dynamic = "force-dynamic";
const panel = "min-w-0 rounded-lg border border-slate-200 bg-white p-5";

export default async function CostsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  await requireAdmin();
  const range = analyticsDateRange(await searchParams);
  const header = <AdminPageHeader title="Token & Cost Usage" description="การใช้งานที่บันทึกจริง และค่าใช้จ่ายประมาณการในช่วงที่เลือก" />;
  const filter = <DateRangeFilter {...range} action="/admin/analytics/costs" />;
  if (range.error) return <main className="space-y-5">{header}{filter}<p role="alert">{range.error}</p></main>;

  let overview;
  try {
    overview = await analyticsCostService.getCostOverview(new Date(), range);
  } catch {
    return <main className="space-y-5">{header}{filter}<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">อ่านข้อมูลการใช้งานไม่สำเร็จ ตรวจสอบการเชื่อมต่อและ schema ของฐานข้อมูล แล้วโหลดใหม่</p></main>;
  }

  const money = (value: number | null) => value === null ? "—" : `฿${value.toFixed(2)}`;
  const metrics = [
    { label: "โทเค็นรวมที่บันทึก", value: overview.totalTokens.toLocaleString(), note: "Token logs + ยอดเดิมใน BotRun โดยไม่นับซ้ำ" },
    { label: "ค่าใช้จ่ายประมาณการที่มีข้อมูลราคา", value: overview.hasData ? money(overview.totalCostThb) : money(0), note: overview.totalCostUsd === null ? "ยังไม่มีรายละเอียดเพียงพอสำหรับคำนวณราคา" : `$${overview.totalCostUsd.toFixed(4)} USD · เฉพาะส่วนที่มีราคา` },
    { label: "โทเค็นที่ยังคำนวณราคาไม่ได้", value: overview.unpricedTokens.toLocaleString(), note: "ไม่มี input/output แยก หรือไม่มีราคาโมเดลที่รองรับ" },
    { label: "Prompt Cached Token Rate", value: overview.cacheHitRatePercent === null ? "—" : `${overview.cacheHitRatePercent.toFixed(1)}%`, note: "Cached prompt tokens / prompt tokens ที่บันทึก" }
  ];
  const maxTokens = Math.max(...overview.dailyStats.map(day => day.tokens), 1);

  return <main className="min-w-0 space-y-5">
    {header}{filter}
    <section aria-label="Usage metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
      {metrics.map(metric => <article key={metric.label} className="min-w-0 bg-white p-5"><h2 className="text-sm text-slate-600">{metric.label}</h2><p className="mt-2 break-words text-2xl font-semibold tracking-tight">{metric.value}</p><p className="mt-2 text-xs leading-5 text-slate-600">{metric.note}</p></article>)}
    </section>
    <p className="text-xs leading-6 text-slate-600">ราคาประมาณการที่บันทึกไว้ ไม่ใช่ยอดใบแจ้งหนี้ · แปลงด้วยอัตราคงที่ {USD_TO_THB_RATE} บาท/USD · ข้อมูลเดิมที่มีเพียง token รวมไม่สามารถแยกราคา router/answer ย้อนหลังได้</p>
    {!overview.detailedLogsAvailable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ฐานข้อมูลยังไม่มีตาราง token logs แสดงเฉพาะยอดเดิมจาก BotRun ที่บันทึกไว้</p>}
    {!overview.hasData && <p role="status" className={panel}>ไม่มีข้อมูล token ที่บันทึกในช่วงวันที่เลือก</p>}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <section className={panel}>
        <h2 className="text-base font-semibold">การใช้งานแยกตามโมเดล AI</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">สัดส่วนโทเค็น · ยอดเดิมที่แยกโมเดลไม่ได้แสดงเป็น Legacy</p>
        <div className="mt-5 space-y-5">{overview.modelBreakdown.map(model => <div key={`${model.provider}/${model.name}`}>
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm"><div className="min-w-0 break-words"><span className="font-medium">{model.name}</span><span className="ml-2 text-xs text-slate-600">({model.provider})</span></div><div className="text-right text-xs leading-5"><p>{money(model.costThb)} · {model.tokens.toLocaleString()} tokens</p>{model.unpricedTokens > 0 && <p className="text-slate-600">ยังไม่มีราคา {model.unpricedTokens.toLocaleString()} tokens</p>}</div></div>
          <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${model.percent}%` }} /></div>
        </div>)}</div>
      </section>
      <section className={panel}>
        <h2 className="text-base font-semibold">แนวโน้มการใช้งานรายวัน</h2>
        <p className="mt-1 text-xs text-slate-600">{range.from} – {range.to} · เวลาไทย</p>
        <div className="mt-5 overflow-x-auto"><div className="flex gap-3" style={{ minWidth: Math.max(240, range.days * 42) }}>
          {overview.dailyStats.map(day => <div key={day.rawDate} className="min-w-0 flex-1 text-center">
            <div className="flex h-40 items-end" title={`${day.rawDate}: ${day.tokens.toLocaleString()} tokens`}><div className="w-full rounded-t bg-emerald-600" style={{ height: `${day.tokens / maxTokens * 100}%` }} /></div>
            <p className="mt-2 whitespace-nowrap text-[11px] text-slate-600">{day.date}</p>
          </div>)}
        </div></div>
        <details className="mt-4 text-xs text-slate-600"><summary className="w-fit cursor-pointer py-2">ดูจำนวนโทเค็นรายวัน</summary><dl className="mt-2 max-h-60 overflow-auto">{overview.dailyStats.map(day => <div key={day.rawDate} className="flex justify-between gap-4 py-1"><dt>{day.rawDate}</dt><dd>{day.tokens.toLocaleString()} tokens</dd></div>)}</dl></details>
      </section>
    </div>
  </main>;
}
