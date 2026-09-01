"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { createBookingAction } from "@/app/actions";
import { cn, formatPrice, formatDuration, weekdayOf, nextDates } from "@/lib/utils";
import {
  applyDurationDiscounts,
  type DurationDiscountLike,
} from "@/lib/pricing-core";

export type BookingCourt = {
  id: string;
  name: string;
  venueName: string;
  pricePerHour: number;
  openingTime: string;
  closingTime: string;
};

type Slot = { startTime: string; available: boolean; hourlyPrice: number };

const SLOT_MINUTES = 30;
const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];

function shortDate(d: string): string {
  return d.slice(5).replace("-", "/");
}

export default function BookingForm({
  venues,
  initialCourtId,
}: {
  venues: {
    id: string;
    name: string;
    courts: {
      id: string;
      name: string;
      pricePerHour: number;
      openingTime: string;
      closingTime: string;
    }[];
  }[];
  initialCourtId: string;
}) {
  // 場地小 icon 色（依場地索引循環）
  const COURT_COLORS = [
    "#3b82f6", "#22c55e", "#f59e0b", "#eab308", "#a855f7", "#ef4444", "#10b981", "#f97316", "#06b6d4", "#ec4899",
  ];

  // 找到初始場地所屬分店
  const [venueId, setVenueId] = useState<string>(() => {
    const init = venues.flatMap((v) => v.courts).find((c) => c.id === initialCourtId);
    return init ? venues.find((v) => v.courts.some((c) => c.id === initialCourtId))!.id : venues[0].id;
  });
  const currentVenue = venues.find((v) => v.id === venueId) ?? venues[0];

  // 從當前分店 + 初始場地建立 court
  const [court, setCourt] = useState(() => {
    const init = currentVenue.courts.find((c) => c.id === initialCourtId) ?? currentVenue.courts[0];
    return {
      id: init.id,
      name: init.name,
      venueName: currentVenue.name,
      pricePerHour: init.pricePerHour,
      openingTime: init.openingTime,
      closingTime: init.closingTime,
    };
  });

  const dates = useMemo(() => nextDates(14), []);
  const [date, setDate] = useState(dates[0]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [discounts, setDiscounts] = useState<DurationDiscountLike[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // 月曆顯示的月份（yyyy-mm）
  const [calMonth, setCalMonth] = useState(() => date.slice(0, 7));

  const [state, action, pending] = useActionState(createBookingAction, {});

  // 選分店 → 切到該店第一個場地
  function selectVenue(vid: string) {
    const v = venues.find((x) => x.id === vid);
    if (!v) return;
    setVenueId(vid);
    const first = v.courts[0];
    setCourt({
      id: first.id,
      name: first.name,
      venueName: v.name,
      pricePerHour: first.pricePerHour,
      openingTime: first.openingTime,
      closingTime: first.closingTime,
    });
    setStartTime(null);
    setSlots([]);
    setLoadedDate(null);
  }

  // 選特定場地
  function selectCourt(cid: string) {
    const c = currentVenue.courts.find((x) => x.id === cid);
    if (!c) return;
    setCourt({
      id: c.id,
      name: c.name,
      venueName: currentVenue.name,
      pricePerHour: c.pricePerHour,
      openingTime: c.openingTime,
      closingTime: c.closingTime,
    });
    setStartTime(null);
    setSlots([]);
    setLoadedDate(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/available?courtId=${court.id}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSlots((d.slots as Slot[]) ?? []);
          setDiscounts((d.discounts as DurationDiscountLike[]) ?? []);
          setLoadedDate(date);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setLoadedDate(date);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [court.id, date]);

  const loading = loadedDate !== date;

  function selectDate(d: string) {
    setDate(d);
    setStartTime(null);
    setCalendarOpen(false);
  }

  // 月曆工具：切換月份
  function shiftMonth(delta: number) {
    const [y, m] = calMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // 產生某月的日期格（weekday 對齊）
  function calendarDays(): { day: number; date: string; isPast: boolean }[] {
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startWeekday = first.getDay(); // 0=日
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: { day: number; date: string; isPast: boolean }[] = [];
    // 填入月初前的空白（padding）
    for (let i = 0; i < startWeekday; i++) cells.push({ day: 0, date: "", isPast: true });
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = ds < localToday();
      cells.push({ day, date: ds, isPast });
    }
    return cells;
  }

  function localToday(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  const calCells = calendarDays();
  const calTitle = `${Number(calMonth.slice(0, 4))} 年 ${Number(calMonth.slice(5, 7))} 月`;
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

  const slotCount = durationMinutes / SLOT_MINUTES;
  const startIdx = slots.findIndex((s) => s.startTime === startTime);
  const selectedSlots =
    startIdx >= 0 ? slots.slice(startIdx, startIdx + slotCount) : [];
  const canBook =
    selectedSlots.length === slotCount && selectedSlots.every((s) => s.available);

  const { baseTotal, discountTotal, total } = applyDurationDiscounts(
    selectedSlots,
    discounts
  );
  const prices = selectedSlots.map((s) => s.hourlyPrice);
  const priceMin = prices.length ? Math.min(...prices) : court.pricePerHour;
  const priceMax = prices.length ? Math.max(...prices) : court.pricePerHour;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="courtId" value={court.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={startTime ?? ""} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />

      {/* 0a. 選擇分店（下拉） */}
      <div>
        <label className="mb-2 block text-sm font-semibold">選擇分店</label>
        <select
          value={venueId}
          onChange={(e) => selectVenue(e.target.value)}
          className="w-full rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-base font-semibold text-emerald-800 focus:border-emerald-500 focus:outline-none"
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              🏟️ {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* 0b. 該分店的場地（彩色小 icon，點選帶資料） */}
      <div>
        <label className="mb-2 block text-sm font-semibold">選擇場地</label>
        <div className="flex flex-wrap gap-2">
          {currentVenue.courts.map((c, i) => {
            const color = COURT_COLORS[i % COURT_COLORS.length];
            const active = court.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCourt(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-emerald-300"
                )}
              >
                {/* 彩色小 icon（場地索引上色） */}
                <span
                  className="inline-block h-8 w-8 rounded-lg text-white"
                  style={{ backgroundColor: color }}
                >
                  <span className="flex h-full items-center justify-center text-sm font-bold">
                    {c.name.replace(/[^0-9]/g, "") || "場"}
                  </span>
                </span>
                <span className={active ? "text-emerald-800" : "text-slate-600"}>
                  {c.name}
                </span>
                {active && <span className="text-emerald-600">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 日期（點下拉 → 展開月曆） */}
      <div className="relative">
        <label className="mb-2 block text-sm font-semibold">1. 選擇日期</label>
        <button
          type="button"
          onClick={() => { setCalendarOpen(!calendarOpen); setCalMonth(date.slice(0, 7)); }}
          className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-base font-semibold text-emerald-800 hover:border-emerald-400"
        >
          <span>
            {weekdayOf(date)} {shortDate(date)}
          </span>
          <span className="text-slate-400">▾</span>
        </button>

        {/* 快選：今天/明天/後天 短橫排 */}
        <div className="mt-2 flex gap-2">
          {dates.slice(0, 3).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => selectDate(d)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm",
                date === d ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-100"
              )}
            >
              {weekdayOf(d)} {shortDate(d)}
            </button>
          ))}
        </div>

        {/* 月曆彈層 */}
        {calendarOpen && (
          <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            {/* 月標題 + 切換 */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">◀</button>
              <span className="font-semibold text-slate-700">{calTitle}</span>
              <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">▶</button>
            </div>
            {/* 星期表頭 */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
              {WEEK.map((w) => <span key={w}>{w}</span>)}
            </div>
            {/* 日期格 */}
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calCells.map((c, i) => (
                <span key={i}>
                  {c.day ? (
                    <button
                      type="button"
                      disabled={c.isPast}
                      onClick={() => selectDate(c.date)}
                      className={cn(
                        "h-9 w-full rounded-lg text-sm",
                        c.isPast && "text-slate-300",
                        !c.isPast && date === c.date && "bg-emerald-600 text-white",
                        !c.isPast && date !== c.date && "text-slate-700 hover:bg-emerald-50"
                      )}
                    >
                      {c.day}
                    </button>
                  ) : (
                    <span />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 時段（中和配色：可訂亮綠、不可訂粉紅、價格上格） */}
      <div>
        <label className="mb-2 block text-sm font-semibold">
          2. 選擇開始時段
        </label>
        {loading ? (
          <p className="text-sm text-slate-500">載入時段中…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-500">當日無可預約時段</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s.startTime}
                type="button"
                disabled={!s.available}
                onClick={() => setStartTime(s.startTime)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm transition-colors",
                  !s.available &&
                    "cursor-not-allowed border-rose-200 bg-rose-100 text-slate-400",
                  s.available &&
                    startTime === s.startTime &&
                    "border-emerald-600 bg-emerald-600 text-white",
                  s.available &&
                    startTime !== s.startTime &&
                    "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                )}
              >
                <span className="block font-bold">{s.startTime}</span>
                <span
                  className={cn(
                    "block text-xs",
                    !s.available
                      ? "text-slate-400 line-through"
                      : startTime === s.startTime
                      ? "text-emerald-100"
                      : "text-emerald-600"
                  )}
                >
                  {s.available ? formatPrice(s.hourlyPrice) : "滿場"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 時長 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">3. 預約時長</label>
        <select
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              {formatDuration(m)}
            </option>
          ))}
        </select>
        {startTime && !canBook && (
          <p className="mt-2 text-sm text-amber-600">
            所選時段加上續接時長已無法完整預約，請重新選擇開始時段或縮短時長。
          </p>
        )}
      </div>

      {/* 試算 */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
        <p className="font-semibold text-emerald-800">
          {court.venueName} · {court.name}
        </p>
        <p className="mt-1 text-slate-600">
          金額試算（{formatDuration(durationMinutes)}
          {priceMin !== priceMax
            ? `，時段價 ${formatPrice(priceMin)}~${formatPrice(priceMax)}/小時`
            : `，時段價 ${formatPrice(priceMin)}/小時`}
          ）
        </p>
        {discountTotal > 0 ? (
          <>
            <p className="mt-1 text-sm text-slate-400 line-through">
              原價 {formatPrice(baseTotal)}
            </p>
            <p className="text-xl font-bold text-emerald-700">
              {formatPrice(total)}
              <span className="ml-2 text-xs font-normal text-rose-600">
                已折 {formatPrice(discountTotal)}
              </span>
            </p>
          </>
        ) : (
          <p className="mt-1 text-xl font-bold text-emerald-700">
            {formatPrice(total)}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          依尖峰/離峰時段計價，跨時段自動分段計算，滿時數再享折扣。
        </p>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !canBook}
        className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "送出中…" : "確認預約"}
      </button>
    </form>
  );
}
