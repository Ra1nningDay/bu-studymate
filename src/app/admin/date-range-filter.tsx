import Link from "next/link";
import { DAY_MS } from "@/lib/analytics-date-range";

type Props = {
  from: string;
  to: string;
  today: string;
  action: string;
  preservedFilters?: Record<string, string | null | undefined>;
};

export function DateRangeFilter({ from, to, today, action, preservedFilters = {} }: Props) {
  const input = "mt-1.5 block h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-emerald-700";
  const retained = Object.entries(preservedFilters).filter((entry): entry is [string, string] => Boolean(entry[1] && entry[1] !== "all"));

  return <form action={action} method="GET" key={`${from}/${to}`} className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-4" aria-label="กรองช่วงวันที่">
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      {retained.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <label className="min-w-0 text-sm text-slate-600 sm:w-48 sm:flex-none">ตั้งแต่วันที่<input type="date" name="from" defaultValue={from} required className={input} /></label>
      <label className="min-w-0 text-sm text-slate-600 sm:w-48 sm:flex-none">ถึงวันที่<input type="date" name="to" defaultValue={to} required className={input} /></label>
      <button className="col-span-2 h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-emerald-700">ใช้ช่วงวันที่</button>
      <div className="col-span-2 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap" role="group" aria-label="ช่วงวันที่ด่วน">
        {[7, 30, 90, 365].map(days => {
          const presetFrom = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
          const active = from === presetFrom && to === today;
          const params = new URLSearchParams([...retained, ["from", presetFrom], ["to", today]]);
          return <Link key={days} href={`${action}?${params}`} aria-current={active ? "true" : undefined} className={`inline-flex h-11 items-center justify-center whitespace-nowrap rounded-md border px-3 text-sm focus-visible:outline-emerald-700 ${active ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{days} วันล่าสุด</Link>;
        })}
      </div>
    </div>
    <p className="text-xs leading-5 text-slate-600">เวลาไทย (Asia/Bangkok) · รวมวันสิ้นสุด · เลือกช่วงได้สูงสุด 366 วัน</p>
  </form>;
}
