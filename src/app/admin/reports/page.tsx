import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDuration, localDateString } from "@/lib/utils";

export const metadata: Metadata = {
  title: "報表",
};

function daysAgo(n: number): string {
  const [y, m, d] = localDateString().split("-").map(Number);
  return localDateString(new Date(Date.UTC(y, m - 1, d - n)));
}

function shortDate(d: string): string {
  return d.slice(5).replace("-", "/");
}

export default async function AdminReportsPage() {
  await requireRole(["admin"]);
  const bookings = await prisma.booking.findMany({
    where: { status: { notIn: ["cancelled", "released"] } },
    orderBy: { date: "asc" },
    include: { court: { include: { venue: true } } },
  });

  const today = localDateString(new Date());

  const inRange = (since: string | null) =>
    bookings.filter((b) => !since || b.date >= since);
  // 營收只算「已收款」（cash/linepay/points）；未收款（含固定訂位）不算
  const sumRevenue = (list: typeof bookings) =>
    list
      .filter((b) => b.paymentStatus !== "unpaid")
      .reduce((s, b) => s + b.totalPrice, 0);

  const revToday = sumRevenue(inRange(today));
  const rev7 = sumRevenue(inRange(daysAgo(6)));
  const rev30 = sumRevenue(inRange(daysAgo(29)));
  const revTotal = sumRevenue(bookings);
  const cntTotal = bookings.length;
  const totalHours = bookings.reduce((s, b) => s + b.durationMinutes, 0);

  // 14 天訂位趨勢
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgo(i);
    const day = bookings.filter((b) => b.date === d);
    trend.push({
      date: d,
      count: day.length,
      revenue: sumRevenue(day),
    });
  }
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));

  // 場地使用率（已訂總時數）
  const courtMap = new Map<
    string,
    { name: string; minutes: number; revenue: number }
  >();
  for (const b of bookings) {
    const cur = courtMap.get(b.court.id) ?? {
      name: `${b.court.venue.name} ${b.court.name}`,
      minutes: 0,
      revenue: 0,
    };
    cur.minutes += b.durationMinutes;
    if (b.paymentStatus !== "unpaid") cur.revenue += b.totalPrice;
    courtMap.set(b.court.id, cur);
  }
  const courtRows = [...courtMap.values()].sort((a, b) => b.minutes - a.minutes);
  const maxCourt = Math.max(1, ...courtRows.map((c) => c.minutes));

  // 時段熱門度（開始小時）
  const hours = new Array(24).fill(0) as number[];
  for (const b of bookings) {
    hours[Number(b.startTime.split(":")[0])]++;
  }
  const maxHour = Math.max(1, ...hours);

  const statCards = [
    { label: "今日營收", value: formatPrice(revToday) },
    { label: "近 7 天營收", value: formatPrice(rev7) },
    { label: "近 30 天營收", value: formatPrice(rev30) },
    { label: "累計營收", value: formatPrice(revTotal) },
    { label: "累計訂位", value: `${cntTotal} 筆` },
    { label: "累計時數", value: formatDuration(totalHours) },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">報表</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 訂位趨勢 */}
      <h2 className="mb-3 mt-10 text-lg font-semibold">近 14 天訂位趨勢</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end gap-1" style={{ height: 160 }}>
          {trend.map((t) => (
            <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-500">{t.count || ""}</span>
              <div
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${(t.count / maxTrend) * 120}px` }}
                title={`${t.date}：${t.count} 筆 / ${formatPrice(t.revenue)}`}
              />
              <span className="text-[10px] text-slate-400">{shortDate(t.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* 場地使用率 */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">場地使用率（已訂時數）</h2>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {courtRows.length === 0 ? (
              <p className="text-sm text-slate-500">尚無訂位資料。</p>
            ) : (
              courtRows.map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-500">
                      {formatDuration(c.minutes)} · {formatPrice(c.revenue)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-emerald-500"
                      style={{ width: `${(c.minutes / maxCourt) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 時段熱門度 */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">時段熱門度（開始時段）</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
              {hours.map((n, h) => (
                <div key={h} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-sky-500"
                    style={{ height: `${(n / maxHour) * 90}px` }}
                    title={`${String(h).padStart(2, "0")}:00 起：${n} 筆`}
                  />
                  <span className="text-[9px] text-slate-400">{h}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">橫軸為開始時段（0–23 點）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
