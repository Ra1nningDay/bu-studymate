import type { AdminOverview } from "@/src/services/admin-overview.service";

export function ConversationChart({ days }: { days: AdminOverview["days"] }) {
  const maximum = Math.max(3, Math.ceil(Math.max(0, ...days.map((item) => item.count)) / 3) * 3);
  const points = days.map((item, index) => ({ x: days.length === 1 ? 296 : 8 + index * 576 / (days.length - 1), y: 154 - item.count / maximum * 144, ...item }));
  const labelStep = Math.max(1, Math.ceil(days.length / 7));
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <figure className="mt-5">
    <div className="flex gap-3">
      <div aria-hidden="true" className="flex h-40 w-5 shrink-0 flex-col justify-between pb-1 text-right text-[13px] text-slate-600">
        {[3, 2, 1, 0].map(index => <span key={index}>{maximum * index / 3}</span>)}
      </div>
      <div className="min-w-0 flex-1">
        <svg role="img" aria-label={`จำนวนผู้สนทนารายวัน: ${days.map((item) => `${item.day}: ${item.count}`).join(", ")}`} viewBox="0 0 592 164" preserveAspectRatio="none" className="h-40 w-full">
          {[0, 1, 2, 3].map(index => <line key={index} x1="8" y1={154 - index * 48} x2="584" y2={154 - index * 48} stroke="#e5e9e6" strokeDasharray="3 3" />)}
          <path d={path} fill="none" stroke="#047857" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.filter(point => point.count > 0).map(point => <circle key={point.day} cx={point.x} cy={point.y} r="3" fill="#047857"><title>{`${point.day}: ${point.count} conversations`}</title></circle>)}
        </svg>
        <div aria-hidden="true" className="mt-2 flex justify-between gap-1 text-[13px] text-slate-600">
          {days.filter((_, index) => index % labelStep === 0 || index === days.length - 1).map(item => <span key={item.day}>{item.day.slice(8)}/{item.day.slice(5, 7)}</span>)}
        </div>
      </div>
    </div>
    <figcaption className="mt-4 text-xs leading-5 text-slate-600">นับ identity ในแต่ละวัน ตามเวลาไทย คนเดิมอาจปรากฏได้หลายวัน</figcaption>
  </figure>;
}

export function IntentChart({ intents, total }: { intents: AdminOverview["topIntents"]; total: number }) {
  return <div className="mt-5">
    <p className="text-sm text-slate-600">{total.toLocaleString()} runs ในช่วงนี้</p>
    <ul className="mt-3 space-y-5 text-sm">
      {intents.map(item => <li key={item.name}>
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-all font-medium">{item.name}</span>
          <span className="shrink-0 text-slate-600">{item.count.toLocaleString()} · {total ? (item.count / total * 100).toFixed(1) : "0.0"}%</span>
        </div>
        <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${total ? item.count / total * 100 : 0}%` }} /></div>
      </li>)}
      {!total && <li className="text-slate-600">ยังไม่มี runs ในช่วงนี้</li>}
    </ul>
  </div>;
}
