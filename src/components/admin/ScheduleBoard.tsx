"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, localDateString, weekdayOf } from "@/lib/utils";
import BookingEditModal, { type ModalBooking } from "./BookingEditModal";
import { adminMoveBookingAction } from "@/app/admin/actions";

type Court = {
  id: string;
  name: string;
  venueName: string;
  openingTime: string;
  closingTime: string;
};

type BoardBooking = {
  id: string;
  courtId: string;
  courtName?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  totalPrice: number;
  memberName?: string;
  status: string;
  paymentStatus?: string;
};

type DragState = {
  booking: BoardBooking;
  grabOffsetX: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type Target = { courtIndex: number; startMin: number; valid: boolean };

const CELL = 32; // 每 30 分的像素寬
const LABEL = 120; // 左側場地欄
const ROW_H = 56; // 每列高
const HEADER_H = 28; // 時間表頭高
const SLOT = 30;

function toMin(t: string): number {
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
function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export default function ScheduleBoard({ courts }: { courts: Court[] }) {
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [bookings, setBookings] = useState<BoardBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMin, setNowMin] = useState(nowMinutes);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState<BoardBooking | null>(null);
  const [error, setError] = useState("");

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const targetRef = useRef<Target | null>(null);

  const openMin = useMemo(
    () => Math.min(...courts.map((c) => toMin(c.openingTime))),
    [courts]
  );
  const closeMin = useMemo(
    () => Math.max(...courts.map((c) => toMin(c.closingTime))),
    [courts]
  );
  const slotStarts = useMemo(() => {
    const out: number[] = [];
    for (let t = openMin; t + SLOT <= closeMin; t += SLOT) out.push(t);
    return out;
  }, [openMin, closeMin]);

  const active = useMemo(
    () => bookings.filter((b) => b.date === date),
    [bookings, date]
  );

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/bookings/week?start=${date}&days=1`)
      .then((r) => r.json())
      .then((d) => {
        const list = ((d.bookings as BoardBooking[]) ?? []).filter(
          (b) => b.date === date
        );
        setBookings(list);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  function dateShift(n: number) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + n);
    setDate(localDateString(d));
  }

  function isOverlap(courtId: string, startMin: number, dur: number, excludeId: string) {
    return active.some(
      (b) =>
        b.id !== excludeId &&
        b.courtId === courtId &&
        toMin(b.startTime) < startMin + dur &&
        startMin < toMin(b.endTime)
    );
  }

  function onPointerDown(e: React.PointerEvent, b: BoardBooking) {
    e.preventDefault();
    const rect = boardRef.current!.getBoundingClientRect();
    const leftPx = ((toMin(b.startTime) - openMin) / SLOT) * CELL;
    const d: DragState = {
      booking: b,
      grabOffsetX: e.clientX - rect.left - LABEL - leftPx,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    dragRef.current = d;
    setDrag(d);
    setTarget(null);
    setError("");
  }

  // 拖移期間監聽 window 的 pointermove/up（比 setPointerCapture 穩）
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const moved = d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
      if (!moved) return;
      const dur = d.booking.durationMinutes ?? 30;
      const innerX = e.clientX - rect.left - LABEL;
      let slotIdx = Math.round((innerX - d.grabOffsetX) / CELL);
      let startMin = openMin + slotIdx * SLOT;
      startMin = Math.max(openMin, Math.min(startMin, closeMin - dur));
      const courtIndex = Math.max(
        0,
        Math.min(courts.length - 1, Math.floor((e.clientY - rect.top - HEADER_H) / ROW_H))
      );
      const court = courts[courtIndex];
      const valid =
        startMin >= nowMin && !isOverlap(court.id, startMin, dur, d.booking.id);
      dragRef.current = { ...d, moved: true };
      setDrag({ ...d, moved: true });
      targetRef.current = { courtIndex, startMin, valid };
      setTarget({ courtIndex, startMin, valid });
    };
    const up = () => {
      const d = dragRef.current;
      const t = targetRef.current;
      if (d && d.moved && t) {
        commitMove(d, t);
      } else if (d && !d.moved) {
        setSelected(d.booking);
      }
      dragRef.current = null;
      targetRef.current = null;
      setDrag(null);
      setTarget(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  async function commitMove(d: DragState, t: Target) {
    const b = d.booking;
    const court = courts[t.courtIndex];
    const startTime = fmtHM(t.startMin);
    if (court.id === b.courtId && startTime === b.startTime) return; // 沒動
    const fd = new FormData();
    fd.set("bookingId", b.id);
    fd.set("courtId", court.id);
    fd.set("date", date);
    fd.set("startTime", startTime);
    const res = await adminMoveBookingAction(fd);
    if (!res.ok) setError(res.error ?? "搬移失敗");
    load();
  }

  const dur = drag?.booking.durationMinutes ?? 30;

  return (
    <div>
      {/* 日期切換 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => dateShift(-1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← 前一天
        </button>
        <button
          onClick={() => setDate(localDateString(new Date()))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          今天
        </button>
        <button
          onClick={() => dateShift(1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          後一天 →
        </button>
        <span className="ml-2 text-sm font-semibold text-slate-700">
          {date}（{weekdayOf(date)}）
        </span>
        {loading && <span className="text-xs text-slate-400">載入中…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          ref={boardRef}
          className="relative select-none"
          style={{ width: `${LABEL + slotStarts.length * CELL}px` }}
        >
          {/* 時間表頭 */}
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{
              gridTemplateColumns: `${LABEL}px repeat(${slotStarts.length}, ${CELL}px)`,
              height: HEADER_H,
            }}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">場地</div>
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
          {courts.map((court, ci) => {
            const courtBookings = active.filter((b) => b.courtId === court.id);
            return (
              <div
                key={court.id}
                className="border-b border-slate-100 last:border-b-0"
                style={{ height: ROW_H, position: "relative" }}
              >
                {/* 左側場地標籤 */}
                <div
                  className="absolute left-0 top-0 z-10 flex flex-col justify-center bg-white px-3"
                  style={{ width: LABEL, height: ROW_H }}
                >
                  <p className="truncate text-sm font-semibold text-slate-700">{court.name}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {court.venueName}
                  </p>
                </div>

                {/* 時段格背景 */}
                <div
                  className="absolute inset-y-0 grid"
                  style={{
                    left: LABEL,
                    right: 0,
                    gridTemplateColumns: `repeat(${slotStarts.length}, ${CELL}px)`,
                  }}
                >
                  {slotStarts.map((s) => (
                    <div
                      key={s}
                      className={cn(
                        "border-l border-slate-100",
                        s < nowMin && "bg-slate-50/70"
                      )}
                    />
                  ))}
                </div>

                {/* 訂位色塊 */}
                {courtBookings.map((b) => {
                  const startMin = toMin(b.startTime);
                  const left = ((startMin - openMin) / SLOT) * CELL;
                  const width = ((b.durationMinutes ?? 30) / SLOT) * CELL;
                  const isDragging = drag?.booking.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => onPointerDown(e, b)}
                      className={cn(
                        "absolute z-20 cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight text-white shadow-sm active:cursor-grabbing",
                        b.status === "pending" ? "bg-amber-500" : "bg-emerald-600",
                        isDragging && "opacity-40"
                      )}
                      style={{
                        left: LABEL + left,
                        top: 4,
                        width: Math.max(width - 2, 20),
                        height: ROW_H - 8,
                        touchAction: "none",
                      }}
                      title={`${b.startTime}–${b.endTime}${b.memberName ? ` · ${b.memberName}` : ""}`}
                    >
                      <p className="truncate font-semibold">
                        {width > 72 ? `${b.startTime}–${b.endTime}` : b.startTime}
                      </p>
                      <p className="truncate opacity-90">{b.memberName ?? ""}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 現在時間紅線 */}
          {nowMin >= openMin && nowMin <= closeMin && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-red-500"
              style={{ left: `${LABEL + ((nowMin - openMin) / SLOT) * CELL}px` }}
            >
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">
                {fmtHM(nowMin)}
              </span>
            </div>
          )}

          {/* 拖移幽靈（吸附預覽） */}
          {drag && target && (
            <div
              className={cn(
                "pointer-events-none absolute z-40 rounded-md border-2",
                target.valid
                  ? "border-emerald-500 bg-emerald-200/80"
                  : "border-red-500 bg-red-200/80"
              )}
              style={{
                left: LABEL + ((target.startMin - openMin) / SLOT) * CELL,
                top: HEADER_H + target.courtIndex * ROW_H + 4,
                width: Math.max((dur / SLOT) * CELL - 2, 20),
                height: ROW_H - 8,
              }}
            />
          )}
        </div>
      </div>

      {/* 圖例 */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-emerald-600" /> 已確認
        </span>
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-amber-500" /> 保留中（未收款）
        </span>
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-slate-100" /> 已過去
        </span>
        <span className="ml-2 text-slate-400">左右拖＝改時間，上下拖＝換面場</span>
      </div>

      {selected && (
        <BookingEditModal
          booking={selected as ModalBooking}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}
