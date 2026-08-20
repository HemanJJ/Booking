"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn, formatPrice } from "@/lib/utils";
import BookingEditModal from "./BookingEditModal";

export type TimelineCourt = {
  id: string;
  name: string;
  venueName: string;
  openingTime: string;
  closingTime: string;
};

export type OverviewBooking = {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  memberName?: string;
  courtName?: string;
  paymentStatus?: string;
  durationMinutes?: number;
};

const SLOT = 30; // 分鐘
const CELL = 24; // 每 30 分鐘的像素寬
const LABEL = 132; // 左側場地欄寬
const REFRESH_MS = 60_000;
const TICK_MS = 30_000;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return "24:00";
  return `${pad(h)}:${pad(m)}`;
}

export default function TodayOverview({
  courts,
  today,
  initialBookings,
}: {
  courts: TimelineCourt[];
  today: string;
  initialBookings: OverviewBooking[];
}) {
  const [bookings, setBookings] = useState<OverviewBooking[]>(initialBookings);
  const [nowMin, setNowMin] = useState(() => nowMinutes());
  const [selected, setSelected] = useState<OverviewBooking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openMin = useMemo(
    () => Math.min(...courts.map((c) => toMinutes(c.openingTime))),
    [courts]
  );
  const closeMin = useMemo(
    () => Math.max(...courts.map((c) => toMinutes(c.closingTime))),
    [courts]
  );
  const slotStarts = useMemo(() => {
    const out: number[] = [];
    for (let t = openMin; t + SLOT <= closeMin; t += SLOT) out.push(t);
    return out;
  }, [openMin, closeMin]);

  const active = useMemo(
    () => bookings.filter((b) => b.date === today),
    [bookings, today]
  );

  // 卡片統計（以付款狀態為準：已收 = 非 unpaid；待收/未收款 = unpaid）
  const paidTotal = active
    .filter((b) => b.paymentStatus !== "unpaid")
    .reduce((s, b) => s + b.totalPrice, 0);
  const pendingTotal = active
    .filter((b) => b.paymentStatus === "unpaid")
    .reduce((s, b) => s + b.totalPrice, 0);
  const unpaidCount = active.filter((b) => b.paymentStatus === "unpaid").length;
  const freeCourts = courts.filter(
    (c) =>
      !active.some(
        (b) =>
          b.courtId === c.id &&
          toMinutes(b.startTime) <= nowMin &&
          nowMin < toMinutes(b.endTime)
      )
  ).length;

  // 每面場的即時狀態文字
  function courtStatus(court: TimelineCourt): {
    text: string;
    dot: string;
  } {
    const ongoing = active.find(
      (b) =>
        b.courtId === court.id &&
        toMinutes(b.startTime) <= nowMin &&
        nowMin < toMinutes(b.endTime)
    );
    if (ongoing) return { text: `使用中 至 ${ongoing.endTime}`, dot: "bg-red-500" };
    const next = active
      .filter((b) => b.courtId === court.id && toMinutes(b.startTime) > nowMin)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];
    if (next) return { text: `下一場 ${next.startTime}`, dot: "bg-sky-500" };
    return { text: "空著", dot: "bg-emerald-500" };
  }

  // 資料刷新
  const refresh = useCallback(() => {
    fetch(`/api/bookings/week?start=${today}&days=1`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.bookings as OverviewBooking[]) ?? [];
        setBookings(list.filter((b) => b.date === today));
      })
      .catch(() => {});
  }, [today]);

  useEffect(() => {
    refresh();
    const clock = setInterval(() => setNowMin(nowMinutes()), TICK_MS);
    const poll = setInterval(refresh, REFRESH_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [refresh, refreshKey]);

  // 現在時間紅線位置
  const nowOffsetPx = ((nowMin - openMin) / SLOT) * CELL;
  const showNowLine = nowMin >= openMin && nowMin <= closeMin;

  function cellFor(
    courtId: string,
    s: number
  ): { cls: string; title: string; booking?: OverviewBooking } {
    const booking = active.find(
      (b) =>
        b.courtId === courtId &&
        toMinutes(b.startTime) <= s &&
        s < toMinutes(b.endTime)
    );
    if (booking) {
      const bStart = toMinutes(booking.startTime);
      const bEnd = toMinutes(booking.endTime);
      if (nowMin >= bEnd)
        return {
          cls: "bg-slate-200",
          title: `${booking.memberName ?? ""} 已結束`,
          booking,
        };
      if (nowMin >= bStart)
        return {
          cls: "bg-red-400",
          title: `使用中 · ${booking.memberName ?? ""}`,
          booking,
        };
      return {
        cls: "bg-sky-400",
        title: `已預訂 · ${booking.memberName ?? ""}`,
        booking,
      };
    }
    if (s < nowMin) return { cls: "bg-slate-50", title: "已過去" };
    return { cls: "bg-emerald-100", title: "空著" };
  }

  const gridCols = `${LABEL}px repeat(${slotStarts.length}, ${CELL}px)`;

  return (
    <div>
      {/* 四張今日總覽卡 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="今日訂位" value={`${active.length} 筆`} accent="text-slate-900" />
        <Card
          label="今日收入"
          value={formatPrice(paidTotal + pendingTotal)}
          sub={`已收 ${formatPrice(paidTotal)} · 待收 ${formatPrice(pendingTotal)}`}
          accent="text-emerald-700"
        />
        <Card
          label="空場數"
          value={`${freeCourts} 面場空著`}
          accent="text-sky-700"
        />
        <Card
          label="未收款"
          value={`${unpaidCount} 筆未收款`}
          accent={unpaidCount > 0 ? "text-amber-600" : "text-slate-900"}
        />
      </div>

      {/* 今日時間軸 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">今日時間軸</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded-sm bg-emerald-100" /> 空著
            </span>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded-sm bg-red-400" /> 使用中
            </span>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded-sm bg-sky-400" /> 已預訂
            </span>
            <span className="flex items-center gap-1">
              <i className="h-3 w-3 rounded-sm bg-slate-200" /> 已結束
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-3 w-0.5 bg-red-500" /> 現在
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{ width: `${LABEL + slotStarts.length * CELL}px` }}
          >
            {/* 時間表頭 */}
            <div
              className="grid border-b border-slate-200 bg-slate-50"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                場地
              </div>
              {slotStarts.map((s) => (
                <div
                  key={s}
                  className="border-l border-slate-100 px-0.5 text-center text-[10px] leading-5 text-slate-400"
                >
                  {s % 60 === 0 ? fmtHM(s) : ""}
                </div>
              ))}
            </div>

            {/* 每面場一列 */}
            {courts.map((court) => {
              const st = courtStatus(court);
              return (
                <div
                  key={court.id}
                  className="grid border-b border-slate-100 last:border-b-0"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="sticky left-0 z-10 flex items-center gap-2 bg-white px-3 py-1.5">
                    <i className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">
                        {court.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {st.text}
                      </p>
                    </div>
                  </div>
                  {slotStarts.map((s) => {
                    const c = cellFor(court.id, s);
                    return (
                      <div
                        key={s}
                        title={`${court.name} ${fmtHM(s)} · ${c.title}`}
                        onClick={
                          c.booking
                            ? () => setSelected({ ...c.booking!, courtName: court.name })
                            : undefined
                        }
                        className={cn(
                          "h-10 border-l border-slate-100",
                          c.cls,
                          c.booking &&
                            "cursor-pointer hover:ring-2 hover:ring-inset hover:ring-emerald-400"
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* 現在時間紅線 */}
            {showNowLine && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-red-500"
                style={{ left: `${LABEL + nowOffsetPx}px` }}
              >
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">
                  {fmtHM(nowMin)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <BookingEditModal
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", accent)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
