"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { nextDates } from "@/lib/utils";
import SlotPicker from "./SlotPicker";
import { adminUpdateBookingAction, type AdminState } from "@/app/admin/actions";
import type { CourtOption } from "./AdminCreateBookingForm";

export type EditBooking = {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  memberName: string;
};

export default function AdminEditBookingForm({
  courts,
  booking,
}: {
  courts: CourtOption[];
  booking: EditBooking;
}) {
  const dates = useMemo(() => {
    const base = nextDates(14);
    if (!base.includes(booking.date)) base.push(booking.date);
    return base.sort();
  }, [booking.date]);

  const [courtId, setCourtId] = useState(booking.courtId);
  const [date, setDate] = useState(booking.date);
  const [startTime, setStartTime] = useState<string | null>(booking.startTime);
  const [durationMinutes, setDurationMinutes] = useState(booking.durationMinutes);

  const [state, action, pending] = useActionState(
    adminUpdateBookingAction,
    {} as AdminState
  );

  const court = courts.find((c) => c.id === courtId) ?? null;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={startTime ?? ""} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />

      {/* 場地 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">場地</label>
        <select
          value={courtId}
          onChange={(e) => {
            setCourtId(e.target.value);
            setStartTime(null);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.venueName} · {c.name}
            </option>
          ))}
        </select>
      </div>

      {court && (
        <SlotPicker
          courtId={court.id}
          pricePerHour={court.pricePerHour}
          dates={dates}
          date={date}
          onDateChange={setDate}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          durationMinutes={durationMinutes}
          onDurationChange={setDurationMinutes}
          excludeBookingId={booking.id}
        />
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !court || !startTime}
        className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "送出中…" : "儲存變更"}
      </button>
    </form>
  );
}
