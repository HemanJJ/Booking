"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn, localDateString, weekdayOf, formatPrice } from "@/lib/utils";

export type WeekCourt = { id: string; name: string; venueName: string };

export type WeekBooking = {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  durationMinutes?: number;
  totalPrice?: number;
  avgHourlyPrice?: number;
  memberName?: string;
  courtName?: string;
  paymentStatus?: string;
};

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function blockColor(mode: "admin" | "public", b: WeekBooking): string {
  if (mode === "public") return "bg-rose-100 text-rose-700";
  // 管理員：依「現行規則解析的平均每小時價」上色（離峰=藍、尖峰=紅、跨時段=黃）
  const avg =
    b.avgHourlyPrice ??
    Math.round((b.totalPrice ?? 0) / ((b.durationMinutes ?? 30) / 60));
  if (avg <= 300) return "bg-sky-100 text-sky-800";
  if (avg >= 400) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

export default function WeekSchedule({
  courts,
  mode,
  onBookingClick,
  refreshKey = 0,
}: {
  courts: WeekCourt[];
  mode: "admin" | "public";
  onBookingClick?: (b: WeekBooking) => void;
  refreshKey?: number;
}) {
  const [weekStart, setWeekStart] = useState<Date>(startOfToday);
  const [bookings, setBookings] = useState<WeekBooking[]>([]);
  const [loadedStart, setLoadedStart] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayStrs = days.map((d) => localDateString(d));
  const startStr = dayStrs[0];
  const todayStr = localDateString(new Date());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/bookings/week?start=${startStr}&days=7`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setBookings((d.bookings as WeekBooking[]) ?? []);
            setLoadedStart(startStr);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBookings([]);
            setLoadedStart(startStr);
          }
        });
    load();
    const timer = setInterval(load, 30_000); // 每 30 秒自動刷新
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [startStr, refreshKey]);

  const loading = loadedStart !== startStr;
  const gridCols = "140px repeat(7, minmax(0, 1fr))";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            ← 上一週
          </button>
          <button
            onClick={() => setWeekStart(startOfToday())}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            今天
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            下一週 →
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {startStr} ~ {dayStrs[6]}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[920px]">
          {/* 表頭：日期 */}
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-400">
              場地
            </div>
            {days.map((_, i) => (
              <div
                key={dayStrs[i]}
                className={cn(
                  "border-l border-slate-100 px-2 py-2 text-center",
                  dayStrs[i] === todayStr && "bg-emerald-50"
                )}
              >
                <div
                  className={cn(
                    "text-xs font-semibold",
                    dayStrs[i] === todayStr
                      ? "text-emerald-700"
                      : "text-slate-600"
                  )}
                >
                  {weekdayOf(dayStrs[i])}
                </div>
                <div className="text-xs text-slate-400">
                  {dayStrs[i].slice(5).replace("-", "/")}
                </div>
              </div>
            ))}
          </div>

          {/* 每一列：一面場 */}
          {courts.map((court) => (
            <div
              key={court.id}
              className="grid border-b border-slate-100 last:border-b-0"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="sticky left-0 flex items-center bg-white px-3 py-2">
                {mode === "public" ? (
                  <Link
                    href={`/courts/${court.id}`}
                    className="text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    {court.name}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-slate-700">
                    {court.name}
                  </span>
                )}
              </div>
              {dayStrs.map((ds) => {
                const dayBookings = bookings.filter(
                  (b) => b.courtId === court.id && b.date === ds
                );
                return (
                  <div
                    key={ds}
                    className={cn(
                      "min-h-[64px] space-y-1 border-l border-slate-100 p-1",
                      ds === todayStr && "bg-emerald-50/50"
                    )}
                  >
                    {loading ? (
                      <div className="px-1 py-1 text-[11px] text-slate-300">
                        …
                      </div>
                    ) : (
                      dayBookings.map((b) => (
                        <div
                          key={b.id}
                          onClick={onBookingClick ? () => onBookingClick(b) : undefined}
                          role={onBookingClick ? "button" : undefined}
                          className={cn(
                            "rounded px-1.5 py-1 text-[11px] leading-tight",
                            blockColor(mode, b),
                            onBookingClick &&
                              "cursor-pointer hover:ring-2 hover:ring-emerald-400"
                          )}
                          title={`${b.startTime}–${b.endTime}${
                            b.memberName ? ` · ${b.memberName}` : ""
                          }${
                            b.totalPrice != null
                              ? ` · ${formatPrice(b.totalPrice)}`
                              : ""
                          }`}
                        >
                          <span className="font-semibold">
                            {b.startTime}–{b.endTime}
                          </span>
                          {mode === "admin" && (
                            <>
                              {b.memberName && (
                                <span className="ml-1">{b.memberName}</span>
                              )}
                              {b.totalPrice != null && (
                                <span className="ml-1 opacity-80">
                                  {formatPrice(b.totalPrice)}
                                </span>
                              )}
                            </>
                          )}
                          {mode === "public" && (
                            <span className="ml-1 opacity-80">已預約</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 圖例 */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {mode === "admin" ? (
          <>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded bg-rose-100" /> 尖峰（≥400/小時）
            </span>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded bg-sky-100" /> 離峰（≤300/小時）
            </span>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded bg-amber-100" /> 跨時段
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            <i className="h-3 w-3 rounded bg-rose-100" /> 已預約
            <span className="ml-2 text-slate-400">空白＝可預約</span>
          </span>
        )}
      </div>
    </div>
  );
}
