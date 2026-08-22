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

      <div
        style={{
          overflowX: "auto",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div
          ref={boardRef}
          style={{
            position: "relative",
            userSelect: "none",
            width: `${LABEL + slotStarts.length * CELL}px`,
          }}
        >
          {/* 時間表頭 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${LABEL}px repeat(${slotStarts.length}, ${CELL}px)`,
              height: HEADER_H,
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              場地
            </div>
            {slotStarts.map((s) => (
              <div
                key={s}
                style={{
                  // 整點=實線、半點=虛線
                  borderLeft:
                    s % 60 === 0
                      ? "1px solid #94a3b8"
                      : "1px dashed #cbd5e1",
                  padding: "0 2px",
                  textAlign: "center",
                  fontSize: 10,
                  lineHeight: "20px",
                  color: "#94a3b8",
                }}
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
                style={{
                  height: ROW_H,
                  position: "relative",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {/* 左側場地標籤 */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    padding: "0 12px",
                    width: LABEL,
                    height: ROW_H,
                  }}
                >
                  <p
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    {court.name}
                  </p>
                  <p
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      color: "#94a3b8",
                    }}
                  >
                    {court.venueName}
                  </p>
                </div>

                {/* 時段格背景（點空白格＝代客下單）— 全內聯定位，任何瀏覽器都精準 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: LABEL,
                    right: 0,
                    display: "grid",
                    gridTemplateColumns: `repeat(${slotStarts.length}, ${CELL}px)`,
                  }}
                >
                  {slotStarts.map((s) => (
                    <div
                      key={s}
                      style={{
                        // 整點=實線、半點=虛線
                        borderLeft:
                          s % 60 === 0
                            ? "1px solid #94a3b8"
                            : "1px dashed #cbd5e1",
                        backgroundColor: s < nowMin ? "rgba(248,250,252,0.7)" : "transparent",
                      }}
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
                        "text-[11px] leading-tight text-white",
                        isDragging && "opacity-40",
                        isResizing && "opacity-80"
                      )}
                      style={{
                        position: "absolute",
                        zIndex: 20,
                        cursor: "grab",
                        overflow: "hidden",
                        borderRadius: 6,
                        padding: "4px 6px",
                        left: LABEL + left,
                        top: 4,
                        width: Math.max(width + resizingW - 2, 20),
                        height: ROW_H - 8,
                        touchAction: "none",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        // 內聯背景色：pending=琥珀、其餘=深綠（避免 Tailwind class 漏載變成白格）
                        backgroundColor:
                          b.status === "pending" ? "#f59e0b" : "#059669",
                      }}
                      title={`${b.startTime}–${b.endTime}${b.memberName ? ` · ${b.memberName}` : ""}`}
                      onClick={(e) => {
                        // 點一下＝快速編輯：只有「真的拖動過」才擋（拖動後瀏覽器
                        // 不會產生 click，此判斷只是保險；沒拖動一律開 modal）
                        if (dragRef.current?.moved) return;
                        setSelected(b);
                        e.stopPropagation();
                      }}
                    >
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {width > 72
                          ? `${b.startTime}–${b.endTime}`
                          : b.startTime}
                      </p>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.9 }}>
                        {b.memberName ?? ""}
                      </p>
                      {/* 右緣拉時長把手（全內聯定位＋視覺提示） */}
                      <div
                        {...resizeHandler}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          zIndex: 30,
                          cursor: "ew-resize",
                          width: 14,
                          borderLeft: "2px solid rgba(255,255,255,0.6)",
                        }}
                        title="拖右緣調整時長"
                      >
                        <span
                          style={{
                            position: "absolute",
                            right: 2,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: 10,
                            lineHeight: 1,
                            opacity: 0.85,
                            writingMode: "vertical-rl",
                          }}
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
                        style={{
                          position: "absolute",
                          left: 2,
                          top: 2,
                          zIndex: 40,
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1,
                          color: "#fff",
                          backgroundColor: "rgba(0,0,0,0.45)",
                          cursor: "pointer",
                          border: "none",
                        }}
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

          {/* 現在時間紅線（原生樣式：細線＋時間標籤） */}
          {nowMin >= openMin && nowMin <= closeMin && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                zIndex: 30,
                pointerEvents: "none",
                left: `${LABEL + ((nowMin - openMin) / SLOT) * CELL}px`,
                width: 2,
                backgroundColor: "#ef4444",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  borderRadius: 4,
                  backgroundColor: "#ef4444",
                  padding: "2px 4px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {fmtHM(nowMin)}
              </span>
            </div>
          )}

          {/* 拖移幽靈（吸附預覽） */}
          {drag && target && (
            <div
              style={{
                position: "absolute",
                zIndex: 40,
                pointerEvents: "none",
                borderRadius: 6,
                border: `2px solid ${target.valid ? "#10b981" : "#ef4444"}`,
                backgroundColor: target.valid
                  ? "rgba(167,243,208,0.8)"
                  : "rgba(254,202,202,0.8)",
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
