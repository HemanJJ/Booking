"use client";

import { cn, formatPrice, formatDuration, weekdayOf } from "@/lib/utils";
import { applyDurationDiscounts } from "@/lib/pricing-core";
import { useCourtSlots } from "./useCourtSlots";

const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];
const SLOT_MINUTES = 30;

function shortDate(d: string): string {
  return d.slice(5).replace("-", "/");
}

/** 日期＋開始時段＋時長＋金額試算（代客下單 / 改單共用） */
export default function SlotPicker({
  courtId,
  pricePerHour,
  dates,
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  durationMinutes,
  onDurationChange,
  excludeBookingId,
}: {
  courtId: string;
  pricePerHour: number;
  dates: string[];
  date: string;
  onDateChange: (d: string) => void;
  startTime: string | null;
  onStartTimeChange: (t: string | null) => void;
  durationMinutes: number;
  onDurationChange: (m: number) => void;
  excludeBookingId?: string;
}) {
  const { slots, discounts, loading, error } = useCourtSlots(
    courtId,
    date,
    excludeBookingId
  );

  const slotCount = durationMinutes / SLOT_MINUTES;
  const startIdx = slots.findIndex((s) => s.startTime === startTime);
  const selectedSlots =
    startIdx >= 0 ? slots.slice(startIdx, startIdx + slotCount) : [];
  const canBook =
    selectedSlots.length === slotCount &&
    selectedSlots.every((s) => s.available);

  const { baseTotal, discountTotal, total } = applyDurationDiscounts(
    selectedSlots,
    discounts
  );
  const prices = selectedSlots.map((s) => s.hourlyPrice);
  const priceMin = prices.length ? Math.min(...prices) : pricePerHour;
  const priceMax = prices.length ? Math.max(...prices) : pricePerHour;

  return (
    <div className="space-y-4">
      {/* 日期 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">日期</label>
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                onDateChange(d);
                onStartTimeChange(null);
              }}
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

      {/* 開始時段 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">開始時段</label>
        {loading ? (
          <p className="text-sm text-slate-500">載入時段中…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-500">{error ?? "當日無可預約時段"}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {slots.map((s) => (
              <button
                key={s.startTime}
                type="button"
                disabled={!s.available}
                onClick={() => onStartTimeChange(s.startTime)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs",
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
        <label className="mb-2 block text-sm font-semibold">預約時長</label>
        <select
          value={durationMinutes}
          onChange={(e) => onDurationChange(Number(e.target.value))}
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

      {/* 金額試算 */}
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
      </div>
    </div>
  );
}
