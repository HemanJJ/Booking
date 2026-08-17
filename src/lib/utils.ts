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

/** 伺服器本地日期字串 YYYY-MM-DD */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 往後 n 天的日期字串陣列（含今天） */
export function nextDates(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push(localDateString(d));
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
