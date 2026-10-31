export const DAY_MS = 24 * 60 * 60 * 1000;
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
export type AnalyticsSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function midnight(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? time - BANGKOK_OFFSET_MS : null;
}

export function analyticsDateRange(params: AnalyticsSearchParams = {}, now = new Date()) {
  const today = new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
  const defaultFrom = new Date(midnight(today)! - 6 * DAY_MS + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
  const from = firstParam(params.from) ?? defaultFrom;
  const to = firstParam(params.to) ?? today;
  const start = midnight(from);
  const lastDay = midnight(to);
  const days = start === null || lastDay === null ? 0 : (lastDay - start) / DAY_MS + 1;
  const error = start === null || lastDay === null
    ? "กรุณาระบุวันที่เริ่มและสิ้นสุดให้ถูกต้อง (YYYY-MM-DD)"
    : days < 1 ? "วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด"
    : days > 366 ? "เลือกช่วงวันที่ได้สูงสุด 366 วัน" : null;
  return { from, to, today, start: new Date(start ?? 0), end: new Date((lastDay ?? 0) + DAY_MS), days, error };
}

export type AnalyticsDateRange = ReturnType<typeof analyticsDateRange>;
