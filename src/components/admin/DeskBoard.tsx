"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { cn, weekdayOf } from "@/lib/utils";
import {
  adminCreateBookingAction,
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

export default function DeskBoard({
  courts,
  bookings,
  members,
  stats,
  today,
}: {
  courts: Court[];
  bookings: DeskBooking[];
  members: MemberOption[];
  stats: { totalBookings: number; revenue: number; unpaidCount: number };
  today: string;
}) {
  const [tab, setTab] = useState<"home" | "board" | "pay" | "list">("home");
  const [openCourt, setOpenCourt] = useState<string | null>(null);
  const [openStart, setOpenStart] = useState<string | null>(null);

  // 時段格：每 30 分，從最早開門到最晚關門
  const openMin = useMemo(() => Math.min(...courts.map((c) => toMin(c.openingTime))), [courts]);
  const closeMin = useMemo(() => Math.max(...courts.map((c) => toMin(c.closingTime))), [courts]);
  const slotStarts = useMemo(() => {
    const out: number[] = [];
    for (let t = openMin; t + SLOT <= closeMin; t += SLOT) out.push(t);
    return out;
  }, [openMin, closeMin]);

  const unpaidList = bookings.filter(
    (b) => b.paymentStatus === "unpaid" || b.paymentStatus === "points"
  );

  const startCol = 16 * 60; // 顯示 16:00 起（櫃台晚間高峰），可改

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
            <BigBtn bg="#2563eb" icon="🕐" label="排班總表" sub="看全場／改時間" onClick={() => setTab("board")} />
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

      {/* ===== 電話訂位總表 ===== */}
      {tab === "board" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 20 }}>📞 電話訂位總表</h2>
            <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{today}（{weekdayOf(today)}）</span>
          </div>
          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
            <div style={{ minWidth: 900 }}>
              {/* 表頭 */}
              <div style={{ display: "flex", height: 34, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ width: 104, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: 14, fontSize: 13, fontWeight: 700, color: "#64748b" }}>場地</div>
                {slotStarts.map((s) => (
                  <div
                    key={s}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#64748b",
                      borderLeft: s % 60 === 0 ? "1px solid #94a3b8" : "1px dashed #cbd5e1",
                    }}
                  >
                    {s % 60 === 0 ? fmtHM(s) : ""}
                  </div>
                ))}
              </div>
              {/* 每面場 */}
              {courts.map((court) => {
                const courtBookings = bookings.filter((b) => b.courtId === court.id);
                return (
                  <div key={court.id} style={{ display: "flex", height: 74, borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ width: 104, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 14 }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{court.name}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{court.venueName}</span>
                    </div>
                    {slotStarts.map((s) => {
                      const overlap = courtBookings.find(
                        (b) => toMin(b.startTime) <= s && s < toMin(b.endTime)
                      );
                      const isStart = overlap && toMin(overlap.startTime) === s;
                      return (
                        <div
                          key={s}
                          style={{
                            flex: 1, position: "relative",
                            borderLeft: s % 60 === 0 ? "1px solid #94a3b8" : "1px dashed #cbd5e1",
                          }}
                        >
                          {overlap && isStart && (
                            <div
                              style={{
                                position: "absolute", top: 7, bottom: 7, left: 4, right: 4,
                                borderRadius: 10, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 700, color: "#fff",
                                backgroundColor: overlap.status === "pending" ? "#f59e0b" : "#059669",
                                // 跨時段：往右延伸到 endTime
                                width: `calc(${((toMin(overlap.endTime) - s) / SLOT) * 100}% - 8px)`,
                                zIndex: 2,
                              }}
                            >
                              <span>{overlap.memberName}</span>
                              <span style={{ fontSize: 10, opacity: 0.85 }}>
                                {overlap.startTime}–{overlap.endTime}
                              </span>
                            </div>
                          )}
                          {!overlap && (
                            <button
                              type="button"
                              onClick={() => { setOpenCourt(court.id); setOpenStart(fmtHM(s)); }}
                              style={{
                                position: "absolute", top: 7, bottom: 7, left: 4, right: 4,
                                borderRadius: 10, border: "2px dashed #cbd5e1",
                                background: "#f8fafc", color: "#94a3b8",
                                fontSize: 18, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              ＋
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
            👆 點「＋」空格＝電話訂位 ｜ 整點實線／半點虛線
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
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 15 }}>
                  <b>{b.startTime}–{b.endTime}</b> {b.memberName}
                  <span style={{ color: "#94a3b8", fontSize: 13 }}> · {b.courtName} · {fmtPrice(b.totalPrice)}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: b.paymentStatus === "cash" || b.paymentStatus === "linepay" ? "#059669" : "#d97706" }}>
                  {b.paymentStatus === "cash" || b.paymentStatus === "linepay" ? "已收現金" : "未收"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 底部導覽 ===== */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", marginTop: 16 }}>
        <NavBtn on={tab === "home"} icon="🏠" label="首頁" onClick={() => setTab("home")} />
        <NavBtn on={tab === "board"} icon="📞" label="電話訂位" onClick={() => setTab("board")} />
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
      </div>
    </div>
  );
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
  const [walkIn, setWalkIn] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payNow, setPayNow] = useState("cash");

  const [state, action, pending] = useActionState(adminCreateBookingAction, {} as AdminState);

  const q = memberQuery.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q)
  );
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
          width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)", maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <input type="hidden" name="courtId" value={court?.id ?? ""} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="startTime" value={startTime} />
        <input type="hidden" name="durationMinutes" value={durationMinutes} />
        <input type="hidden" name="payNow" value={payNow} />
        <input type="hidden" name="source" value="phone" />
        <input type="hidden" name="returnTo" value="/admin/desk" />
        <input type="hidden" name="memberId" value={walkIn ? "" : memberId} />
        <input type="hidden" name="name" value={walkIn ? name : ""} />
        <input type="hidden" name="phone" value={walkIn ? phone : ""} />
        <input type="hidden" name="note" value="📞 電話訂位" />

        <h2 style={{ fontSize: 21, marginBottom: 2 }}>📞 電話訂位</h2>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
          {court?.venueName} · {court?.name} · {date} {startTime} 起
        </div>

        {/* 時長 */}
        <div style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 8px" }}>時長</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              style={{
                minHeight: 48, padding: "0 16px", borderRadius: 12,
                border: `2px solid ${durationMinutes === m ? "#059669" : "#cbd5e1"}`,
                background: durationMinutes === m ? "#ecfdf5" : "#fff",
                color: durationMinutes === m ? "#059669" : "#0f172a",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              {m === 60 ? "1 小時" : m === 90 ? "1.5 小時" : m === 120 ? "2 小時" : `${m} 分`}
            </button>
          ))}
        </div>

        {/* 客人 */}
        <div style={{ fontSize: 15, fontWeight: 700, margin: "14px 0 8px" }}>客人</div>
        {!walkIn ? (
          <div>
            <input
              type="text"
              placeholder="搜尋會員（姓名／電話）"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              style={{ width: "100%", height: 52, fontSize: 18, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px", marginBottom: 8 }}
            />
            <div style={{ maxHeight: 160, overflowY: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              {filtered.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMemberId(m.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
                    border: "none", background: memberId === m.id ? "#ecfdf5" : "#fff",
                    fontSize: 16, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {m.name} <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 13 }}>{m.phone ?? ""}</span>
                  {memberId === m.id ? " ✓" : ""}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setWalkIn(true); setMemberId(""); }}
              style={{ marginTop: 8, border: "none", background: "none", color: "#059669", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              ＋ 臨時客人（輸入姓名＋電話）
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="text" placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", height: 52, fontSize: 18, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px" }} />
            <input type="tel" placeholder="電話（選填）" value={phone} onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", height: 52, fontSize: 18, borderRadius: 12, border: "2px solid #cbd5e1", padding: "0 14px" }} />
            <button type="button" onClick={() => setWalkIn(false)}
              style={{ border: "none", background: "none", color: "#64748b", fontSize: 14, cursor: "pointer", textAlign: "left" }}>
              ← 改選既有會員
            </button>
          </div>
        )}

        {/* 收款 */}
        <div style={{ fontSize: 15, fontWeight: 700, margin: "14px 0 8px" }}>收款</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setPayNow("cash")}
            style={{ flex: 1, minHeight: 52, borderRadius: 12, border: `2px solid ${payNow === "cash" ? "#059669" : "#cbd5e1"}`, background: payNow === "cash" ? "#ecfdf5" : "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            💰 已收現金
          </button>
          <button type="button" onClick={() => setPayNow("unpaid")}
            style={{ flex: 1, minHeight: 52, borderRadius: 12, border: `2px solid ${payNow === "unpaid" ? "#d97706" : "#cbd5e1"}`, background: payNow === "unpaid" ? "#fef3c7" : "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            未收（保留 24h）
          </button>
        </div>

        <div style={{ display: "inline-block", background: "#fef9c3", color: "#854d0e", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, marginTop: 12 }}>
          📞 電話訂位（log 會標記來源）
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
