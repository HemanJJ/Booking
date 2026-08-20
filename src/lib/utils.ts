/** 簡易 classNames 合併 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 金額格式：NT$ 400 */
export function formatPrice(amount: number): string {
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

/** "YYYY-MM-DD" → "2026/08/17" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${m}/${d}`;
}

/** 台灣時區偏移（Asia/Taipei = UTC+8，無日光節約） */
export const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;

const taiwanDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 台灣（Asia/Taipei）日期字串 YYYY-MM-DD —— 伺服器 UTC 或瀏覽器任意時區都正確 */
export function localDateString(d: Date = new Date()): string {
  const p = taiwanDateFmt.formatToParts(d);
  const y = p.find((x) => x.type === "year")!.value;
  const m = p.find((x) => x.type === "month")!.value;
  const day = p.find((x) => x.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

/** 往後 n 天的「台灣日期」字串陣列（含今天） */
export function nextDates(days: number): string[] {
  const out: string[] = [];
  const [y, m, d] = localDateString().split("-").map(Number);
  for (let i = 0; i < days; i++) {
    out.push(localDateString(new Date(Date.UTC(y, m - 1, d + i))));
  }
  return out;
}

/** "2026-08-17" → 星期幾（zh-TW） */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("zh-TW", { weekday: "short" });
}

/** 營業時間顯示（00:00–24:00 → 24 小時營業；24:00 顯示為 00:00） */
export function formatHours(openingTime: string, closingTime: string): string {
  if (openingTime === "00:00" && closingTime === "24:00") {
    return "24 小時營業";
  }
  const close = closingTime === "24:00" ? "00:00" : closingTime;
  return `${openingTime} – ${close}`;
}

/** 時長顯示（分鐘 → 30 分鐘 / 1 小時 / 1 小時 30 分） */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分`;
}
