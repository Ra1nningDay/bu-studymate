import type { AdminOverview } from "@/src/services/admin-overview.service";

const colors = ["#008c52", "#19b971", "#67d7a0", "#a6eacc", "#f6cf63", "#a9b5c4"];

export function ConversationChart({ days }: { days: AdminOverview["days"] }) {
  const maximum = Math.max(3, Math.ceil(Math.max(0, ...days.map((item) => item.count)) / 3) * 3);
  const points = days.map((item, index) => ({ x: 42 + index * 96, y: 190 - item.count / maximum * 145, ...item }));
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <figure>
    <svg role="img" aria-label={`จำนวนผู้สนทนารายวัน: ${days.map((item) => `${item.day}: ${item.count}`).join(", ")}`} viewBox="0 0 660 238" className="mt-5 w-full">
      <defs><linearGradient id="conversation-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36cd86" stopOpacity=".3" /><stop offset="100%" stopColor="#36cd86" stopOpacity=".03" /></linearGradient></defs>
      {[0, 1, 2, 3].map((index) => <g key={index}><line x1="42" y1={190 - index * 48} x2="618" y2={190 - index * 48} stroke="#e4ede9" strokeDasharray="3 3" /><text x="30" y={194 - index * 48} textAnchor="end" fill="#789087" fontSize="11">{Math.round(maximum * index / 3)}</text></g>)}
      <path d={`${path} L 618 190 L 42 190 Z`} fill="url(#conversation-fill)" />
      <path d={path} fill="none" stroke="#009957" strokeWidth="3" />
      {points.map((point) => <g key={point.day}><circle cx={point.x} cy={point.y} r="5" fill="#00a45d" stroke="white" strokeWidth="2"><title>{`${point.day}: ${point.count} conversations`}</title></circle><text x={point.x} y={point.y - 12} textAnchor="middle" fill="#047345" fontSize="11">{point.count}</text><text x={point.x} y="216" textAnchor="middle" fill="#789087" fontSize="11">{point.day.slice(8)}/{point.day.slice(5, 7)}</text></g>)}
    </svg>
    <figcaption className="text-xs leading-5 text-slate-500">นับ identity ที่ส่งข้อความในแต่ละวัน ตามเวลาไทย คนเดิมอาจปรากฏได้หลายวัน</figcaption>
  </figure>;
}

export function IntentChart({ intents, total }: { intents: AdminOverview["topIntents"]; total: number }) {
  let offset = 0;
  return <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
    <svg role="img" aria-label={`สัดส่วน intent จาก ${total} runs`} viewBox="0 0 180 180" className="w-44 shrink-0">
      <circle cx="90" cy="90" r="65" pathLength="100" fill="none" stroke="#edf2ef" strokeWidth="29" />
      {intents.map((item, index) => {
        const portion = total ? item.count / total * 100 : 0;
        const current = offset; offset += portion;
        return <circle key={item.name} cx="90" cy="90" r="65" pathLength="100" fill="none" stroke={colors[index]} strokeWidth="29" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={-current} transform="rotate(-90 90 90)"><title>{`${item.name}: ${item.count}`}</title></circle>;
      })}
      <text x="90" y="88" textAnchor="middle" fill="#101b36" fontSize="22" fontWeight="700">{total.toLocaleString()}</text><text x="90" y="109" textAnchor="middle" fill="#789087" fontSize="12">runs</text>
    </svg>
    <ul className="min-w-0 flex-1 space-y-3 text-xs">
      {intents.map((item, index) => <li key={item.name} className="flex items-start justify-between gap-3"><span className="flex min-w-0 items-start gap-2"><span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} /><span className="break-all">{item.name}</span></span><span className="shrink-0 font-medium">{(item.count / total * 100).toFixed(1)}%</span></li>)}
      {!total && <li className="text-slate-500">ยังไม่มี runs ในช่วงนี้</li>}
    </ul>
  </div>;
}
