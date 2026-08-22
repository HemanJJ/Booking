"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, localDateString, weekdayOf } from "@/lib/utils";
import BookingEditModal, { type ModalBooking } from "./BookingEditModal";
import QuickCreateModal from "./QuickCreateModal";
import {
  adminMoveBookingAction,
  adminResizeBookingAction,
} from "@/app/admin/actions";
import type { MemberOption } from "./AdminCreateBookingForm";

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

type MouseLike = {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  stopPropagation?: () => void;
};

type DragState = {
  booking: BoardBooking;
  grabOffsetX: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type ResizeState = {
  booking: BoardBooking;
  startX: number;
  origDuration: number;
  moved: boolean;
};

type Target = { courtIndex: number; startMin: number; valid: boolean };

const CELL = 32; // 每 30 分的像素寬
const LABEL = 120; // 左側場地欄
const ROW_H = 56; // 每列高
const HEADER_H = 28; // 時間表頭高
const SLOT = 30;
const MAX_DUR = 240; // 最長 4 小時

// 注意：互動一律用 Mouse Events（onMouseDown/mousemove/mouseup），
// 最舊瀏覽器（含 IE、Safari 舊版）都支援，不依賴 PointerEvent 偵測。

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
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function ScheduleBoard({
  courts,
  members,
}: {
  courts: Court[];
  members: MemberOption[];
}) {
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [bookings, setBookings] = useState<BoardBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMin, setNowMin] = useState(nowMinutes);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [resizeDur, setResizeDur] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState<BoardBooking | null>(null);
  const [quickCreate, setQuickCreate] = useState<{
    courtId: string;
    courtName: string;
    venueName: string;
    startTime: string;
  } | null>(null);
  const [error, setError] = useState("");

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const resizeDurRef = useRef<number | null>(null);
  const targetRef = useRef<Target | null>(null);
  // 拖移/拉長監聽（down 當下同步掛載，up 移除；避免 React re-render 造成的 race）
  // 一律用 Mouse Events（最舊瀏覽器也支援；不依賴 PointerEvent 偵測）
  const evtMove = "mousemove";
  const evtUp = "mouseup";
  const moveFnRef = useRef<((e: MouseEvent | PointerEvent) => void) | null>(null);
  const upFnRef = useRef<(() => void) | null>(null);

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

  function isOverlap(
    courtId: string,
    startMin: number,
    dur: number,
    excludeId: string
  ) {
    return active.some(
      (b) =>
        b.id !== excludeId &&
        b.courtId === courtId &&
        toMin(b.startTime) < startMin + dur &&
        startMin < toMin(b.endTime)
    );
  }

  // ===== 開始拖移（改時間 / 換場） =====
  function onGrabDown(e: MouseLike, b: BoardBooking) {
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
    attachListeners();
  }

  // ===== 開始拉時長（右緣把手） =====
  function onResizeDown(e: MouseLike, b: BoardBooking) {
    e.preventDefault();
    e.stopPropagation?.();
    const r: ResizeState = {
      booking: b,
      startX: e.clientX,
      origDuration: b.durationMinutes ?? 30,
      moved: false,
    };
    resizeRef.current = r;
    setResize(r);
    resizeDurRef.current = r.origDuration;
    setResizeDur(r.origDuration);
    setError("");
    attachListeners();
  }

  // 拖移/拉長監聽：在 down 當下同步掛載（不等 React re-render），up 時移除。
  // 舊版做法用 useEffect([drag]) 掛載 → 快速點擊時 pointerup 比 effect 先到 → 事件丟失（點一下沒反應）。
  const moveRef = useRef<(e: MouseEvent | PointerEvent) => void>(() => {});
  const upRef = useRef<() => void>(() => {});
  const listeningRef = useRef(false);

  function attachListeners() {
    if (listeningRef.current) return;
    listeningRef.current = true;
    window.addEventListener(evtMove, moveRef.current);
    window.addEventListener(evtUp, upRef.current);
  }
  function detachListeners() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    window.removeEventListener(evtMove, moveRef.current);
    window.removeEventListener(evtUp, upRef.current);
  }

  // move/up 邏輯（每次 render 更新 ref，讀取最新 courts/nowMin/active）
  moveRef.current = (e: MouseEvent | PointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // ---- 拉時長 ----
    const rz = resizeRef.current;
    if (rz) {
      const moved = rz.moved || Math.abs(e.clientX - rz.startX) > 3;
      if (!moved) return;
      const deltaSlots = Math.round((e.clientX - rz.startX) / CELL);
      const slots = clamp(
        rz.origDuration / SLOT + deltaSlots,
        SLOT / SLOT,
        MAX_DUR / SLOT
      );
      const newDur = slots * SLOT;
      const startMin = toMin(rz.booking.startTime);
      const ok =
        startMin + newDur <= closeMin &&
        !isOverlap(rz.booking.courtId, startMin, newDur, rz.booking.id);
      resizeRef.current = { ...rz, moved: true };
      setResize({ ...rz, moved: true });
      resizeDurRef.current = ok ? newDur : rz.booking.durationMinutes ?? 30;
      setResizeDur(resizeDurRef.current);
      return;
    }

    // ---- 拖移 ----
    const d = dragRef.current;
    if (!d) return;
    const moved =
      d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
    if (!moved) return;
    const dur = d.booking.durationMinutes ?? 30;
    const innerX = e.clientX - rect.left - LABEL;
    let slotIdx = Math.round((innerX - d.grabOffsetX) / CELL);
    let startMin = openMin + slotIdx * SLOT;
    startMin = Math.max(openMin, Math.min(startMin, closeMin - dur));
    const courtIndex = Math.max(
      0,
      Math.min(
        courts.length - 1,
        Math.floor((e.clientY - rect.top - HEADER_H) / ROW_H)
      )
    );
    const court = courts[courtIndex];
    const valid =
      startMin >= nowMin && !isOverlap(court.id, startMin, dur, d.booking.id);
    dragRef.current = { ...d, moved: true };
    setDrag({ ...d, moved: true });
    targetRef.current = { courtIndex, startMin, valid };
    setTarget({ courtIndex, startMin, valid });
  };

  upRef.current = () => {
    // 拉時長結束 → 提交
    const rz = resizeRef.current;
    if (rz && rz.moved) {
      commitResize(rz, resizeDurRef.current ?? rz.origDuration);
    }
    // 拖移結束 → 提交或開快速編輯
    const d = dragRef.current;
    const t = targetRef.current;
    if (d && d.moved && t) {
      commitMove(d, t);
    } else if (d && !d.moved) {
      setSelected(d.booking);
    }
    dragRef.current = null;
    targetRef.current = null;
    resizeRef.current = null;
    resizeDurRef.current = null;
    setDrag(null);
    setTarget(null);
    setResize(null);
    setResizeDur(null);
    detachListeners();
  };

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

  async function commitResize(r: ResizeState, newDur: number) {
    if (newDur === r.origDuration) return; // 沒動
    const fd = new FormData();
    fd.set("bookingId", r.booking.id);
    fd.set("durationMinutes", String(newDur));
    const res = await adminResizeBookingAction(fd);
    if (!res.ok) setError(res.error ?? "調整時長失敗");
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
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">
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
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {court.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {court.venueName}
                  </p>
                </div>

                {/* 時段格背景（點空白格＝代客下單） */}
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
                      onClick={() => {
                        const slotCourtId = court.id;
                        const slotStart = fmtHM(s);
                        const occupied = courtBookings.some(
                          (b) =>
                            toMin(b.startTime) <= s && s < toMin(b.endTime)
                        );
                        if (occupied) return;
                        setQuickCreate({
                          courtId: slotCourtId,
                          courtName: court.name,
                          venueName: court.venueName,
                          startTime: slotStart,
                        });
                      }}
                    />
                  ))}
                </div>

                {/* 訂位色塊 */}
                {courtBookings.map((b) => {
                  const startMin = toMin(b.startTime);
                  const left = ((startMin - openMin) / SLOT) * CELL;
                  const width = ((b.durationMinutes ?? 30) / SLOT) * CELL;
                  const isDragging = drag?.booking.id === b.id;
                  const isResizing = resize?.booking.id === b.id;
                  const resizingW =
                    isResizing && resizeDur
                      ? ((resizeDur - (b.durationMinutes ?? 30)) / SLOT) * CELL
                      : 0;
                  // 統一用 Mouse Events（所有瀏覽器都支援，含舊版；不依賴 PointerEvent）
                  const grabHandler = {
                    onMouseDown: (e: React.MouseEvent) => onGrabDown(e, b),
                  };
                  const resizeHandler = {
                    onMouseDown: (e: React.MouseEvent) => onResizeDown(e, b),
                  };
                  return (
                    <div
                      key={b.id}
                      {...grabHandler}
                      className={cn(
                        "absolute z-20 cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight text-white shadow-sm active:cursor-grabbing",
                        b.status === "pending" ? "bg-amber-500" : "bg-emerald-600",
                        isDragging && "opacity-40",
                        isResizing && "opacity-80"
                      )}
                      style={{
                        left: LABEL + left,
                        top: 4,
                        width: Math.max(width + resizingW - 2, 20),
                        height: ROW_H - 8,
                        touchAction: "none",
                      }}
                      title={`${b.startTime}–${b.endTime}${b.memberName ? ` · ${b.memberName}` : ""}`}
                      onClick={(e) => {
                        // 點一下＝快速編輯（onClick 是保險路徑：若滑鼠按住移動過，
                        // 瀏覽器不會產生 click；只有「點一下」才觸發）
                        if (dragRef.current) return;
                        setSelected(b);
                        e.stopPropagation();
                      }}
                    >
                      <p className="truncate font-semibold">
                        {width > 72
                          ? `${b.startTime}–${b.endTime}`
                          : b.startTime}
                      </p>
                      <p className="truncate opacity-90">
                        {b.memberName ?? ""}
                      </p>
                      {/* 右緣拉時長把手（加寬＋視覺提示） */}
                      <div
                        {...resizeHandler}
                        className="absolute right-0 top-0 bottom-0 z-30 cursor-ew-resize"
                        style={{ width: 14, borderLeft: "2px solid rgba(255,255,255,0.55)" }}
                        title="拖右緣調整時長"
                      >
                        <span
                          className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[10px] leading-none opacity-80"
                          style={{ writingMode: "vertical-rl" }}
                        >
                          ⠿
                        </span>
                      </div>
                      {/* 編輯按鈕（不依賴拖移，點它就開快速編輯） */}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(b);
                        }}
                        className="absolute left-0.5 top-0.5 z-40 rounded bg-white/25 px-1 py-0.5 text-[10px] font-bold leading-none text-white hover:bg-white/40"
                        title="快速編輯"
                      >
                        ✏️
                      </button>
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
        <span className="ml-2 text-slate-400">
          左右拖＝改時間，上下拖＝換面場，拖右緣＝調時長，點空白格＝代客下單
        </span>
      </div>

      {selected && (
        <BookingEditModal
          booking={selected as ModalBooking}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      )}

      {quickCreate && (
        <QuickCreateModal
          courtId={quickCreate.courtId}
          courtName={quickCreate.courtName}
          venueName={quickCreate.venueName}
          date={date}
          startTime={quickCreate.startTime}
          members={members}
          onClose={() => setQuickCreate(null)}
        />
      )}
    </div>
  );
}
