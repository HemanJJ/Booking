"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";
import { weekdayOf } from "@/lib/utils";
import {
  adminCreateBookingAction,
  adminMoveBookingAction,
  adminResizeBookingAction,
  adminAdjustDurationAction,
  adminCancelBookingAction,
  toggleCashPaymentAction,
  type AdminState,
} from "@/app/admin/actions";
import type { MemberOption } from "./AdminCreateBookingForm";

type Court = { id: string; name: string; venueName: string; openingTime: string; closingTime: string };
type DeskBooking = {
  id: string;
  courtId: string;
  courtName: string;
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalPrice: number;
  memberName: string;
  status: string;
  paymentStatus: string;
};

const SLOT = 30;
const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];

// 觸控友善排班板參數（大格子方便手指）
const CELL = 40; // 每 30 分的像素寬
const LABEL = 104; // 左側場地欄
const ROW_H = 72; // 每列高（手指拖移舒適）
const HEADER_H = 30;
const MAX_DUR = 240;

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  return `${pad(h)}:${pad(min % 60)}`;
}
function fmtPrice(n: number): string {
  return `NT$${n.toLocaleString("zh-TW")}`;
}
function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

type TouchLike = { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void };

export default function DeskBoard({
  courts,
  bookings,
  members,
  stats,
  today,
  role = "staff",
}: {
  courts: Court[];
  bookings: DeskBooking[];
  members: MemberOption[];
  stats: { totalBookings: number; revenue: number; unpaidCount: number };
  today: string;
  role?: string;
}) {
  const [tab, setTab] = useState<"home" | "board" | "pay" | "list">("home");
  const [openCourt, setOpenCourt] = useState<string | null>(null);
  const [openStart, setOpenStart] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeskBooking | null>(null);
  const [nowMin, setNowMin] = useState(nowMinutes);
  const [error, setError] = useState("");
  // 館長才有完整管理（拖移/編輯/取消）；staff 只做電話訂位/收款/明細
  const isOwner = role === "admin";
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 時段格：每 30 分，從最早開門到最晚關門
  const openMin = useMemo(() => Math.min(...courts.map((c) => toMin(c.openingTime))), [courts]);
  const closeMin = useMemo(() => Math.max(...courts.map((c) => toMin(c.closingTime))), [courts]);
  const slotStarts = useMemo(() => {
    const out: number[] = [];
    for (let t = openMin; t + SLOT <= closeMin; t += SLOT) out.push(t);
    return out;
  }, [openMin, closeMin]);

  // 進排班總表時：自動滑到「現在」（預設顯示現在～+4h 視窗）
  useEffect(() => {
    if (tab === "board") {
      const el = scrollerRef.current;
      if (!el) return;
      // 把「現在」滑到畫面約 1/4 處，後面留 4 小時可視
      const nowSlot = clamp(Math.round((nowMin - openMin) / SLOT), 0, slotStarts.length - 1);
      const targetLeft = nowSlot * CELL - Math.max(el.clientWidth * 0.25, 0);
      el.scrollTo({ left: Math.max(targetLeft, 0), behavior: "smooth" });
    }
  }, [tab]); // 只進 tab 時跳一次；之後用手動按鈕

  // 「跳到現在」＋左右快捷
  // offsetMin = 0 → 跳到「現在」；非 0 → 從「當前捲動位置」相對跳（前/後 2 小時）
  function jumpTo(offsetMin: number) {
    const el = scrollerRef.current;
    if (!el) return;
    let target: number;
    if (offsetMin === 0) {
      target = clamp(Math.round((nowMin - openMin) / SLOT), 0, slotStarts.length - 1);
    } else {
      const curSlot = clamp(Math.round(el.scrollLeft / CELL), 0, slotStarts.length - 1);
      target = clamp(curSlot + offsetMin / SLOT, 0, slotStarts.length - 1);
    }
    const left = target * CELL - el.clientWidth * 0.25;
    el.scrollTo({ left: Math.max(left, 0), behavior: "smooth" });
  }

  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  const unpaidList = bookings.filter(
    (b) => b.paymentStatus === "unpaid" || b.paymentStatus === "points"
  );

  // ===== 手指/滑鼠拖移（改時間、換場） =====
  type DragState = {
    booking: DeskBooking;
    grabOffsetX: number;
    startX: number;
    startY: number;
    moved: boolean;
    isTouch: boolean;
  };
  type Target = { courtIndex: number; startMin: number; valid: boolean };

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const targetRef = useRef<Target | null>(null);
  const listeningRef = useRef(false);
  // 觸控優先：觸發 touch 後，瀏覽器會補發相容 mouse 事件，用此旗標擋掉避免雙觸發
  const touchActiveRef = useRef(false);
  const moveFnRef = useRef<(e: TouchEvent | MouseEvent) => void>(() => {});
  const upFnRef = useRef<() => void>(() => {});
  // ghost 用 state 驅動（ref 變化不會觸發 re-render）
  const [ghost, setGhost] = useState<Target | null>(null);

  function attachListeners() {
    if (listeningRef.current) return;
    listeningRef.current = true;
    window.addEventListener("touchmove", moveFnRef.current, { passive: false });
    window.addEventListener("touchend", upFnRef.current);
    window.addEventListener("mousemove", moveFnRef.current);
    window.addEventListener("mouseup", upFnRef.current);
  }
  function detachListeners() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    window.removeEventListener("touchmove", moveFnRef.current);
    window.removeEventListener("touchend", upFnRef.current);
    window.removeEventListener("mousemove", moveFnRef.current);
    window.removeEventListener("mouseup", upFnRef.current);
  }

  function isOverlap(courtId: string, startMin: number, dur: number, excludeId: string): boolean {
    return bookings.some(
      (b) =>
        b.id !== excludeId &&
        b.courtId === courtId &&
        toMin(b.startTime) < startMin + dur &&
        startMin < toMin(b.endTime)
    );
  }

  function onGrabDown(e: TouchLike, b: DeskBooking, isTouch: boolean) {
    e.preventDefault();
    if (isTouch) touchActiveRef.current = true;
    const rect = boardRef.current!.getBoundingClientRect();
    const leftPx = ((toMin(b.startTime) - openMin) / SLOT) * CELL;
    const d: DragState = {
      booking: b,
      grabOffsetX: e.clientX - rect.left - LABEL - leftPx,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      isTouch,
    };
    dragRef.current = d;
    targetRef.current = null;
    setError("");
    attachListeners();
  }

  moveFnRef.current = (e: TouchEvent | MouseEvent) => {
    if (e instanceof TouchEvent && touchActiveRef.current && e.touches.length === 0) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const d = dragRef.current;
    if (!d) return;
    if (e instanceof TouchEvent) e.preventDefault(); // 拖移中阻止頁面捲動
    const cx = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
    const cy = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;
    if (!d.moved && Math.hypot(cx - d.startX, cy - d.startY) < 8) return; // 小於 8px 視為點擊
    const dur = d.booking.durationMinutes || 30;
    const innerX = cx - rect.left - LABEL;
    let slotIdx = Math.round((innerX - d.grabOffsetX) / CELL);
    let startMin = openMin + slotIdx * SLOT;
    startMin = clamp(startMin, openMin, closeMin - dur);
    const courtIndex = clamp(
      Math.floor((cy - rect.top - HEADER_H) / ROW_H),
      0,
      courts.length - 1
    );
    const court = courts[courtIndex];
    const valid =
      startMin >= nowMin && !isOverlap(court.id, startMin, dur, d.booking.id);
    dragRef.current = { ...d, moved: true };
    targetRef.current = { courtIndex, startMin, valid };
    setGhost({ courtIndex, startMin, valid });
    setError("");
  };

  upFnRef.current = () => {
    const d = dragRef.current;
    const t = targetRef.current;
    if (d && d.moved && t) {
      void commitMove(d, t);
    } else if (d && !d.moved) {
      setSelected(d.booking); // 沒拖動＝點擊 → 開編輯
    }
    dragRef.current = null;
    targetRef.current = null;
    setGhost(null);
    touchActiveRef.current = false;
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
    fd.set("date", b.date);
    fd.set("startTime", startTime);
    const res = await adminMoveBookingAction(fd);
    if (!res.ok) setError(res.error ?? "搬移失敗");
    setSelected(null);
  }

  const dur = 30;

  return (
    <div style={{ fontFamily: '-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif', minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 頂部品牌列（全螢幕櫃台用） */}
      <div
        style={{
          background: "#064e3b", color: "#fff", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 800 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dearfly-logo.png" alt="Dearfly" style={{ height: 32 }} />
          Dearfly 櫃台
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {today.slice(5)}（{weekdayOf(today)}）
        </div>
      </div>

      <div style={{ flex: 1, padding: 16 }}>
      {/* ===== 首頁 ===== */}
      {tab === "home" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Stat n={String(stats.totalBookings)} l="今日訂位" color="#059669" />
            <Stat n={fmtPrice(stats.revenue)} l="已收款" color="#d97706" />
            <Stat n="－" l="空場中" color="#2563eb" />
            <Stat n={String(stats.unpaidCount)} l="未收款" color="#dc2626" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <BigBtn bg="#059669" icon="📞" label="電話訂位" sub="點空格直接記" onClick={() => setTab("board")} />
            {isOwner && (
              <BigBtn bg="#2563eb" icon="🕐" label="排班總表" sub="拖移改時間／點色塊編輯" onClick={() => setTab("board")} />
            )}
            <BigBtn bg="#d97706" icon="💵" label="收款" sub="未收 → 已收" onClick={() => setTab("pay")} />
            <BigBtn bg="#7c3aed" icon="📋" label="今日明細" sub="全部訂位" onClick={() => setTab("list")} />
          </div>
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 16, marginTop: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            }}
          >
            <h3 style={{ fontSize: 17, marginBottom: 6 }}>現在：{today}（{weekdayOf(today)}）</h3>
            <p style={{ fontSize: 15, color: "#475569" }}>
              今日 {stats.totalBookings} 筆訂位 ｜ 已收 {fmtPrice(stats.revenue)} ｜ {stats.unpaidCount} 筆未收
            </p>
          </div>
        </div>
      )}

      {/* ===== 排班總表（觸控版） ===== */}
      {tab === "board" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 20 }}>{isOwner ? "🕐 排班總表" : "📞 電話訂位"}</h2>
            <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{today}（{weekdayOf(today)}）</span>
          </div>
          {/* 跳到現在＋左右快捷（11 吋平板不用手滑） */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => jumpTo(0)}
              style={{
                flex: 1, height: 52, borderRadius: 12, border: "none",
                background: "#059669", color: "#fff", fontSize: 17, fontWeight: 800,
                cursor: "pointer",
              }}
            >
              📍 現在
            </button>
            <button
              type="button"
              onClick={() => jumpTo(-120)}
              style={{
                flex: 1, height: 52, borderRadius: 12, border: "1px solid #cbd5e1",
                background: "#fff", color: "#475569", fontSize: 17, fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ⬅ 前2小時
            </button>
            <button
              type="button"
              onClick={() => jumpTo(120)}
              style={{
                flex: 1, height: 52, borderRadius: 12, border: "1px solid #cbd5e1",
                background: "#fff", color: "#475569", fontSize: 17, fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ➡ 後2小時
            </button>
          </div>
          {error && (
            <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 10 }}>
              {error}
            </div>
          )}
          <div ref={scrollerRef} style={{ overflowX: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
            <div
              ref={boardRef}
              style={{ position: "relative", userSelect: "none", width: LABEL + slotStarts.length * CELL }}
            >
              {/* 時間表頭 */}
              <div style={{ display: "flex", height: HEADER_H, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ width: LABEL, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: 14, fontSize: 13, fontWeight: 700, color: "#64748b" }}>場地</div>
                {slotStarts.map((s) => (
                  <div
                    key={s}
                    style={{
                      width: CELL, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#64748b",
                      borderLeft: s % 60 === 0 ? "1px solid #94a3b8" : "1px dashed #cbd5e1",
                    }}
                  >
                    {s % 60 === 0 ? fmtHM(s) : ""}
                  </div>
                ))}
              </div>

              {/* 每面場一列 */}
              {courts.map((court, ci) => {
                const courtBookings = bookings.filter((b) => b.courtId === court.id);
                return (
                  <div key={court.id} style={{ position: "relative", height: ROW_H, borderBottom: "1px solid #e2e8f0" }}>
                    {/* 左側場地標籤 */}
                    <div style={{ position: "absolute", left: 0, top: 0, zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "center", background: "#fff", padding: "0 10px", width: LABEL, height: ROW_H }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{court.name}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{court.venueName}</span>
                    </div>

                    {/* 時段格背景（點空白格＝代客下單） */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: LABEL, right: 0, display: "flex" }}>
                      {slotStarts.map((s) => (
                        <div
                          key={s}
                          style={{
                            width: CELL, flexShrink: 0,
                            borderLeft: s % 60 === 0 ? "1px solid #94a3b8" : "1px dashed #cbd5e1",
                            background: s < nowMin ? "rgba(248,250,252,0.7)" : "transparent",
                          }}
                          onClick={() => {
                            const occupied = courtBookings.some(
                              (b) => toMin(b.startTime) <= s && s < toMin(b.endTime)
                            );
                            if (occupied) return;
                            setOpenCourt(court.id);
                            setOpenStart(fmtHM(s));
                          }}
                        />
                      ))}
                    </div>

                    {/* 訂位色塊（可拖移、可點編輯；僅館長） */}
                    {courtBookings.map((b) => {
                      const startMin = toMin(b.startTime);
                      const left = ((startMin - openMin) / SLOT) * CELL;
                      const width = ((b.durationMinutes || 30) / SLOT) * CELL;
                      return (
                        <div
                          key={b.id}
                          {...(isOwner
                            ? {
                                onTouchStart: (e: React.TouchEvent) => {
                                  const t = e.touches[0];
                                  if (t) onGrabDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() }, b, true);
                                },
                                onMouseDown: (e: React.MouseEvent) => {
                                  if (touchActiveRef.current) return;
                                  onGrabDown(e, b, false);
                                },
                                onClick: (e: React.MouseEvent) => {
                                  if (dragRef.current?.moved) return;
                                  setSelected(b);
                                  e.stopPropagation();
                                },
                              }
                            : {})}
                          style={{
                            position: "absolute",
                            zIndex: 20,
                            cursor: isOwner ? "grab" : "default",
                            overflow: "hidden",
                            borderRadius: 10,
                            padding: "6px 8px",
                            left: LABEL + left + 2,
                            top: 4,
                            width: Math.max(width - 4, 24),
                            height: ROW_H - 8,
                            touchAction: isOwner ? "none" : "auto",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            // 內聯背景色（避免 Tailwind class 漏載變成白格）
                            backgroundColor: b.status === "pending" ? "#f59e0b" : "#059669",
                            color: "#fff",
                            fontSize: 13,
                          }}
                          title={`${b.startTime}–${b.endTime} · ${b.memberName}${isOwner ? "" : "（僅館長可編輯）"}`}
                        >
                          <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, fontSize: 13 }}>
                            {width > 88 ? `${b.startTime}–${b.endTime}` : b.startTime}
                          </p>
                          <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.92, fontSize: 12 }}>
                            {b.memberName}
                          </p>
                          {/* 右緣拉時長把手（僅館長） */}
                          {isOwner && (
                            <div
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                const t = e.touches[0];
                                if (t) onResizeDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() }, b, true);
                              }}
                              onMouseDown={(e) => { if (touchActiveRef.current) return; e.stopPropagation(); onResizeDown(e, b, false); }}
                              style={{
                                position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 30,
                                cursor: "ew-resize", width: 18,
                                borderLeft: "2px solid rgba(255,255,255,0.65)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                              title="拖右緣調整時長"
                            >
                              <span style={{ fontSize: 11, opacity: 0.9, writingMode: "vertical-rl" }}>⠿</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* 現在時間紅線 */}
              {nowMin >= openMin && nowMin <= closeMin && (
                <div style={{ position: "absolute", top: 0, bottom: 0, zIndex: 30, pointerEvents: "none", left: LABEL + ((nowMin - openMin) / SLOT) * CELL, width: 2, background: "#ef4444" }}>
                  <span style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", borderRadius: 4, background: "#ef4444", padding: "2px 4px", fontSize: 10, fontWeight: 600, color: "#fff" }}>
                    {fmtHM(nowMin)}
                  </span>
                </div>
              )}

              {/* 拖移預覽（吸附到目標格） */}
              {dragGhost()}
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
            👆 左右拖＝改時間，上下拖＝換面場，拖右緣＝調時長，點色塊＝編輯，點「＋」空格＝電話訂位
          </p>
        </div>
      )}

      {/* ===== 收款 ===== */}
      {tab === "pay" && (
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>💵 收款</h2>
          {unpaidList.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", color: "#059669", fontWeight: 700, fontSize: 17 }}>
              ✅ 全部已收款！
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 16, padding: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
              {unpaidList.map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 12px", borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{b.memberName}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      {b.courtName} · {b.startTime}–{b.endTime} · {fmtPrice(b.totalPrice)}
                    </div>
                  </div>
                  <form action={toggleCashPaymentAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button
                      type="submit"
                      style={{
                        border: "none", borderRadius: 10, padding: "12px 16px",
                        fontSize: 14, fontWeight: 700, cursor: "pointer",
                        background: "#fef3c7", color: "#92400e",
                      }}
                    >
                      未收 → 點收款
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 今日明細 ===== */}
      {tab === "list" && (
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>📋 今日訂位（{bookings.length}）</h2>
          <div style={{ background: "#fff", borderRadius: 16, padding: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
            {bookings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => isOwner && setSelected(b)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: "1px solid #f1f5f9", background: "none", width: "100%", textAlign: "left", cursor: isOwner ? "pointer" : "default", border: "none" }}
              >
                <div style={{ fontSize: 15 }}>
                  <b>{b.startTime}–{b.endTime}</b> {b.memberName}
                  <span style={{ color: "#94a3b8", fontSize: 13 }}> · {b.courtName} · {fmtPrice(b.totalPrice)}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: b.paymentStatus === "cash" || b.paymentStatus === "linepay" ? "#059669" : "#d97706" }}>
                  {b.paymentStatus === "cash" || b.paymentStatus === "linepay" ? "已收現金" : "未收"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== 底部導覽 ===== */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", marginTop: 16 }}>
        <NavBtn on={tab === "home"} icon="🏠" label="首頁" onClick={() => setTab("home")} />
        {isOwner && <NavBtn on={tab === "board"} icon="🕐" label="排班" onClick={() => setTab("board")} />}
        <NavBtn on={tab === "pay"} icon="💵" label="收款" onClick={() => setTab("pay")} />
        <NavBtn on={tab === "list"} icon="📋" label="明細" onClick={() => setTab("list")} />
      </div>

      {/* ===== 電話訂位彈窗 ===== */}
      {openCourt && openStart && (
        <PhoneBookModal
          court={courts.find((c) => c.id === openCourt) ?? null}
          startTime={openStart}
          date={today}
          members={members}
          onClose={() => { setOpenCourt(null); setOpenStart(null); }}
          onDone={() => { setOpenCourt(null); setOpenStart(null); }}
        />
      )}

      {/* ===== 編輯訂位彈窗 ===== */}
      {selected && (
        <DeskEditModal
          booking={selected}
          courts={courts}
          allBookings={bookings}
          today={today}
          slotStarts={slotStarts}
          onClose={() => setSelected(null)}
        />
      )}
      </div>
    </div>
  );

  /** 拖移中的吸附預覽 */
  function dragGhost() {
    const d = dragRef.current;
    const t = ghost;
    if (!d || !t) return null;
    const durMin = d.booking.durationMinutes || 30;
    return (
      <div
        style={{
          position: "absolute",
          zIndex: 40,
          pointerEvents: "none",
          borderRadius: 10,
          border: `3px solid ${t.valid ? "#10b981" : "#ef4444"}`,
          background: t.valid ? "rgba(167,243,208,0.85)" : "rgba(254,202,202,0.85)",
          left: LABEL + ((t.startMin - openMin) / SLOT) * CELL + 2,
          top: HEADER_H + t.courtIndex * ROW_H + 4,
          width: Math.max((durMin / SLOT) * CELL - 4, 24),
          height: ROW_H - 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: t.valid ? "#065f46" : "#991b1b",
          fontSize: 13, fontWeight: 700,
        }}
      >
        {t.valid ? "✓ 移到這" : "✗ 已被佔"}
      </div>
    );
  }

  /** 右緣拉時長 */
  function onResizeDown(e: TouchLike, b: DeskBooking, isTouch: boolean) {
    e.preventDefault();
    if (isTouch) touchActiveRef.current = true;
    const startX = e.clientX;
    const origDuration = b.durationMinutes || 30;
    let cur = origDuration;
    const rect = boardRef.current!.getBoundingClientRect();
    const startMin = toMin(b.startTime);
    const onMove = (ev: TouchEvent | MouseEvent) => {
      if (ev instanceof TouchEvent) ev.preventDefault();
      const cx = ev instanceof TouchEvent ? ev.touches[0].clientX : ev.clientX;
      const deltaSlots = Math.round((cx - startX) / CELL);
      const slots = clamp(origDuration / SLOT + deltaSlots, SLOT / SLOT, MAX_DUR / SLOT);
      const newDur = slots * SLOT;
      const ok =
        startMin + newDur <= closeMin &&
        !isOverlap(b.courtId, startMin, newDur, b.id);
      cur = ok ? newDur : origDuration;
    };
    const onUp = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mouseup", onUp);
      touchActiveRef.current = false;
      if (cur !== origDuration) {
        const fd = new FormData();
        fd.set("bookingId", b.id);
        fd.set("durationMinutes", String(cur));
        void adminResizeBookingAction(fd).then((res) => {
          if (!res.ok) setError(res.error ?? "調整時長失敗");
        });
      }
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchend", onUp);
    window.addEventListener("mouseup", onUp);
  }
}

function Stat({ n, l, color }: { n: string; l: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "12px 8px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{n}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{l}</div>
    </div>
  );
}

function BigBtn({ bg, icon, label, sub, onClick }: { bg: string; icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: 110, borderRadius: 18, border: "none", background: bg, color: "#fff",
        fontSize: 22, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.18)",
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      {label}
      <small style={{ fontSize: 13, fontWeight: 500, opacity: 0.9, marginTop: 2 }}>{sub}</small>
    </button>
  );
}

function NavBtn({ on, icon, label, onClick }: { on: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: "12px 4px 14px", border: "none", background: "#fff",
        fontSize: 13, fontWeight: 700, cursor: "pointer",
        color: on ? "#059669" : "#64748b",
        borderTop: on ? "3px solid #059669" : "3px solid transparent",
      }}
    >
      <span style={{ fontSize: 24, display: "block", marginBottom: 2 }}>{icon}</span>
      {label}
    </button>
  );
}

/** 電話訂位彈窗：姓名＋電話＋時長＋收款 → adminCreateBookingAction(source=phone) */
function PhoneBookModal({
  court,
  startTime,
  date,
  members,
  onClose,
  onDone,
}: {
  court: Court | null;
  startTime: string;
  date: string;
  members: MemberOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [memberId, setMemberId] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [searching, setSearching] = useState(false); // 輸入才展開第二層選單
  const [walkIn, setWalkIn] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payNow, setPayNow] = useState("cash");

  const [state, action, pending] = useActionState(adminCreateBookingAction, {} as AdminState);

  const q = memberQuery.trim().toLowerCase();
  const filtered = members
    .filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q)
    )
    .slice(0, 5);

  // 已選到會員 → 顯示鎖定狀態（不再展開清單）
  const lockedMember = members.find((m) => m.id === memberId);
  const canSubmit = !!court && (!walkIn ? !!memberId : name.trim().length > 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60, overflowY: "auto",
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, padding: "18px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          maxHeight: "92vh", overflowY: "auto",
        }}
      >
        <input type="hidden" name="courtId" value={court?.id ?? ""} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="startTime" value={startTime} />
        <input type="hidden" name="durationMinutes" value={durationMinutes} />
        <input type="hidden" name="payNow" value={payNow} />
        <input type="hidden" name="source" value="phone" />
        <input type="hidden" name="returnTo" value="/desk" />
        <input type="hidden" name="memberId" value={walkIn ? "" : memberId} />
        <input type="hidden" name="name" value={walkIn ? name : ""} />
        <input type="hidden" name="phone" value={walkIn ? phone : ""} />
        <input type="hidden" name="note" value="📞 電話訂位" />

        {/* 標題＋場次：一行 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 19 }}>📞 電話訂位</h2>
          <span style={{ fontSize: 13, color: "#64748b" }}>{court?.name} · {startTime} 起</span>
        </div>

        {/* 時長：一行（下拉＋快捷） */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>時長</span>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            style={{ flex: 1, height: 46, border: "2px solid #cbd5e1", borderRadius: 12, padding: "0 12px", fontSize: 16, background: "#fff" }}
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>{m === 60 ? "1 小時" : m === 90 ? "1.5 小時" : m === 120 ? "2 小時" : `${m} 分`}</option>
            ))}
          </select>
          <button type="button" onClick={() => setDurationMinutes(Math.min(durationMinutes + 30, 240))}
            style={{ height: 46, padding: "0 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            ＋30
          </button>
        </div>

        {/* 客人 */}
        <div style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 6px" }}>客人</div>
        {!walkIn ? (
          <div>
            {lockedMember ? (
              // 已選到會員 → 顯示鎖定狀態，可重選
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, borderRadius: 12, border: "2px solid #059669", background: "#ecfdf5", padding: "0 14px" }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#059669" }}>
                  ✓ {lockedMember.name} <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 13 }}>{lockedMember.phone ?? ""}</span>
                </span>
                <button type="button" onClick={() => { setMemberId(""); setSearching(false); }}
                  style={{ border: "none", background: "none", color: "#059669", fontSize: 14, cursor: "pointer" }}>
                  重選
                </button>
              </div>
            ) : (
              <>
                {/* 搜尋框：預設不展開清單 */}
                <input
                  type="text"
                  placeholder="輸入姓名或電話查詢會員"
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setSearching(true); }}
                  onFocus={() => setSearching(true)}
                  style={{ width: "100%", height: 48, fontSize: 17, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px" }}
                />
                {/* 第二層選單：只在輸入時浮出 */}
                {searching && (
                  <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    {q === "" && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>輸入姓名或電話開始搜尋…</div>
                    )}
                    {q !== "" && filtered.length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 14, color: "#64748b" }}>找不到「{memberQuery}」</div>
                    )}
                    {filtered.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setMemberId(m.id); setSearching(false); }}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", padding: "12px 14px",
                          border: "none", background: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span>{m.name}</span>
                        <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 13 }}>{m.phone ?? ""}</span>
                      </button>
                    ))}
                    {q !== "" && filtered.length === 0 && (
                      <button
                        type="button"
                        onClick={() => { setWalkIn(true); setMemberQuery(""); }}
                        style={{ width: "100%", padding: "12px 14px", border: "none", background: "#fef9c3", color: "#854d0e", fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                      >
                        ＋ 新增臨時客人（姓名＋電話）
                      </button>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => setWalkIn(true)}
                  style={{ marginTop: 8, border: "none", background: "none", color: "#059669", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  ＋ 臨時客人（不搜尋）
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="text" placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              style={{ width: "100%", height: 48, fontSize: 17, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px" }} />
            <input type="tel" placeholder="電話（選填）" value={phone} onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", height: 48, fontSize: 17, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px" }} />
            <button type="button" onClick={() => { setWalkIn(false); setMemberQuery(""); }}
              style={{ border: "none", background: "none", color: "#64748b", fontSize: 14, cursor: "pointer", textAlign: "left" }}>
              ← 改選既有會員
            </button>
          </div>
        )}

        {/* 收款：一行（標題＋兩鍵） */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>收款</span>
          <button type="button" onClick={() => setPayNow("cash")}
            style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${payNow === "cash" ? "#059669" : "#cbd5e1"}`, background: payNow === "cash" ? "#ecfdf5" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            💰 已收現金
          </button>
          <button type="button" onClick={() => setPayNow("unpaid")}
            style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${payNow === "unpaid" ? "#d97706" : "#cbd5e1"}`, background: payNow === "unpaid" ? "#fef3c7" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            未收（保留 24h）
          </button>
        </div>

        {state?.error && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 10, padding: 12, fontSize: 14, marginTop: 10 }}>
            {state.error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, height: 60, borderRadius: 14, border: "none", background: "#e2e8f0", color: "#475569", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
            取消
          </button>
          <button type="submit" disabled={pending || !canSubmit}
            style={{ flex: 1, height: 60, borderRadius: 14, border: "none", background: "#059669", color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer", opacity: pending || !canSubmit ? 0.5 : 1 }}>
            {pending ? "送出中…" : "✅ 建立訂位"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** 編輯訂位彈窗（頁內完整改單，不離開櫃台模式）：改時長／換場／改時段／收款／取消 */
function DeskEditModal({
  booking,
  courts,
  allBookings,
  today,
  slotStarts,
  onClose,
}: {
  booking: DeskBooking;
  courts: Court[];
  allBookings: DeskBooking[];
  today: string;
  slotStarts: number[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [durInput, setDurInput] = useState(String(booking.durationMinutes ?? 30));
  const [newCourtId, setNewCourtId] = useState(booking.courtId);
  const [newStart, setNewStart] = useState(booking.startTime);
  const [moveDur, setMoveDur] = useState(booking.durationMinutes ?? 30);

  const PAY_LABEL: Record<string, string> = {
    unpaid: "未收",
    cash: "已收現金",
    linepay: "LINE Pay",
    points: "點數",
  };
  const active = booking.status !== "cancelled" && booking.status !== "released";

  /** 直接輸入時長（分鐘）套用 */
  async function applyDuration() {
    const n = Number(durInput);
    if (!Number.isInteger(n) || n < 30 || n > 240 || n % 30 !== 0) {
      setErr("時長須為 30 的倍數（30~240 分）");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("bookingId", booking.id);
      fd.set("durationMinutes", String(n));
      const res = await adminResizeBookingAction(fd);
      if (!res.ok) throw new Error(res.error ?? "調整時長失敗");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "調整時長失敗");
      setBusy(false);
    }
  }

  async function adjust(delta: number) {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("id", booking.id);
      fd.set("delta", String(delta));
      await adminAdjustDurationAction(fd);
      onClose();
    } catch {
      setErr("操作失敗");
      setBusy(false);
    }
  }

  /** 套用「換場＋改時段」（時長用 moveDur） */
  async function applyMove() {
    if (newCourtId === booking.courtId && newStart === booking.startTime && moveDur === booking.durationMinutes) {
      onClose();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      // 先搬移（時長不變），再調時長（若不同）
      const fd = new FormData();
      fd.set("bookingId", booking.id);
      fd.set("courtId", newCourtId);
      fd.set("date", booking.date);
      fd.set("startTime", newStart);
      const res = await adminMoveBookingAction(fd);
      if (!res.ok) throw new Error(res.error ?? "搬移失敗");
      if (moveDur !== booking.durationMinutes) {
        const fd2 = new FormData();
        fd2.set("bookingId", booking.id);
        fd2.set("durationMinutes", String(moveDur));
        const res2 = await adminResizeBookingAction(fd2);
        if (!res2.ok) throw new Error(res2.error ?? "調整時長失敗");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "改單失敗");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("確定取消這筆訂位？時段會釋放。")) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("id", booking.id);
      await adminCancelBookingAction(fd);
      onClose();
    } catch {
      setErr("取消失敗");
      setBusy(false);
    }
  }

  // 換場＋改時段的防重疊檢查（用真實 bookings）
  const newStartMin = toMin(newStart);
  const overlap =
    newStartMin + moveDur > closeOf(courts, newCourtId) ||
    allBookings.some(
      (b) =>
        b.id !== booking.id &&
        b.courtId === newCourtId &&
        toMin(b.startTime) < newStartMin + moveDur &&
        newStartMin < toMin(b.endTime)
    );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60, overflowY: "auto",
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)", maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 style={{ fontSize: 21 }}>✏️ 編輯訂位</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>

        {/* 訂位資訊 */}
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 14 }}>
          <p style={{ fontSize: 17, fontWeight: 800 }}>{booking.memberName}</p>
          <p style={{ color: "#475569", marginTop: 2 }}>
            {booking.courtName} · {booking.date} · <b>{booking.startTime}–{booking.endTime}</b>
          </p>
          <p style={{ color: "#64748b", marginTop: 2 }}>
            {fmtPrice(booking.totalPrice)} ｜ 收款：{PAY_LABEL[booking.paymentStatus ?? "unpaid"] ?? "未收"}
            {booking.paymentStatus === "cash" || booking.paymentStatus === "linepay" ? " ✅" : ""}
          </p>
        </div>

        {active ? (
          <>
            {/* 時長 */}
            <div style={{ fontSize: 15, fontWeight: 700, margin: "16px 0 8px" }}>⏱ 時長</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number" min={30} max={240} step={30}
                value={durInput}
                onChange={(e) => setDurInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyDuration(); }}
                style={{ flex: 1, minWidth: 0, height: 48, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 16 }}
                disabled={busy}
              />
              <button type="button" onClick={applyDuration} disabled={busy}
                style={{ height: 48, padding: "0 16px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                套用
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => adjust(30)} disabled={busy || (booking.durationMinutes ?? 0) >= 240}
                style={{ flex: 1, height: 48, borderRadius: 10, border: "none", background: "#d1fae5", color: "#065f46", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
                ＋30 分
              </button>
              <button type="button" onClick={() => adjust(-30)} disabled={busy || (booking.durationMinutes ?? 0) <= 30}
                style={{ flex: 1, height: 48, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
                －30 分
              </button>
            </div>

            {/* 換場＋改時段 */}
            <div style={{ fontSize: 15, fontWeight: 700, margin: "16px 0 8px" }}>🔄 換場／改時段</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {courts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewCourtId(c.id)}
                  style={{
                    padding: "8px 14px", borderRadius: 10,
                    border: `2px solid ${newCourtId === c.id ? "#059669" : "#cbd5e1"}`,
                    background: newCourtId === c.id ? "#ecfdf5" : "#fff",
                    color: newCourtId === c.id ? "#059669" : "#0f172a",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflowY: "auto", padding: 4 }}>
              {slotStarts
                .filter((s) => s + moveDur <= closeOf(courts, newCourtId))
                .map((s) => {
                  const hm = fmtHM(s);
                  const isSel = hm === newStart;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewStart(hm)}
                      style={{
                        padding: "8px 10px", borderRadius: 8,
                        border: `2px solid ${isSel ? "#059669" : "#e2e8f0"}`,
                        background: isSel ? "#ecfdf5" : "#fff",
                        color: isSel ? "#059669" : "#334155",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {hm}
                    </button>
                  );
                })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>時長</span>
              <select
                value={moveDur}
                onChange={(e) => setMoveDur(Number(e.target.value))}
                style={{ flex: 1, height: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 8px", fontSize: 15, background: "#fff" }}
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>{m === 60 ? "1 小時" : m === 90 ? "1.5 小時" : m === 120 ? "2 小時" : `${m} 分`}</option>
                ))}
              </select>
              <button type="button" onClick={applyMove} disabled={busy || overlap}
                style={{ height: 44, padding: "0 18px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: busy || overlap ? 0.5 : 1 }}>
                套用搬移
              </button>
            </div>
            {overlap && (
              <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 6 }}>⚠️ 目標時段已被預訂或超出營業時間</p>
            )}

            {/* 收款切換 */}
            <div style={{ fontSize: 15, fontWeight: 700, margin: "16px 0 8px" }}>💵 收款</div>
            <form action={toggleCashPaymentAction}>
              <input type="hidden" name="id" value={booking.id} />
              <button type="submit"
                style={{ width: "100%", height: 52, borderRadius: 12, border: "none", background: booking.paymentStatus === "cash" || booking.paymentStatus === "linepay" ? "#fef3c7" : "#d1fae5", color: booking.paymentStatus === "cash" || booking.paymentStatus === "linepay" ? "#92400e" : "#065f46", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
                {booking.paymentStatus === "cash" || booking.paymentStatus === "linepay" ? "已收 → 改為未收" : "未收 → 點收款"}
              </button>
            </form>

            {/* 取消 */}
            <button type="button" onClick={cancel} disabled={busy}
              style={{ width: "100%", height: 52, borderRadius: 12, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 10 }}>
              取消訂位（釋放時段）
            </button>
          </>
        ) : (
          <p style={{ marginTop: 12, background: "#f1f5f9", borderRadius: 10, padding: 12, textAlign: "center", fontSize: 14, color: "#64748b" }}>
            此訂位已{booking.status === "cancelled" ? "取消" : "釋放"}
          </p>
        )}

        {err && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );

  function closeOf(courtList: Court[], courtId: string): number {
    const c = courtList.find((x) => x.id === courtId);
    return c ? toMin(c.closingTime) : 24 * 60;
  }
}
