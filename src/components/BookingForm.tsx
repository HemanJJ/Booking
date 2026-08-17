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

export default function BookingForm({ court }: { court: BookingCourt }) {
  const dates = useMemo(() => nextDates(14), []);
  const [date, setDate] = useState(dates[0]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [discounts, setDiscounts] = useState<DurationDiscountLike[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);

  const [state, action, pending] = useActionState(createBookingAction, {});

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
  }

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

      {/* 日期 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">1. 選擇日期</label>
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => selectDate(d)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                date === d
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              )}
            >
              <span className="block font-medium">{shortDate(d)}</span>
              <span className="block text-xs opacity-80">{weekdayOf(d)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 時段 */}
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
                  "rounded-lg border px-2 py-2 text-sm",
                  !s.available &&
                    "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through",
                  s.available &&
                    startTime === s.startTime &&
                    "border-emerald-600 bg-emerald-600 text-white",
                  s.available &&
                    startTime !== s.startTime &&
                    "border-slate-300 text-slate-700 hover:bg-slate-100"
                )}
              >
                {s.startTime}
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="text-slate-600">
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
