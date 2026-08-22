"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  adminAdjustDurationAction,
  adminCancelBookingAction,
} from "@/app/admin/actions";

export type ModalBooking = {
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

const PAY_LABEL: Record<string, string> = {
  unpaid: "未收",
  cash: "已收現金",
  linepay: "LINE Pay",
  points: "點數",
};

export default function BookingEditModal({
  booking,
  onClose,
  onChanged,
}: {
  booking: ModalBooking;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function adjust(delta: number) {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("id", booking.id);
      fd.set("delta", String(delta));
      await adminAdjustDurationAction(fd);
      onChanged();
      onClose();
    } catch {
      setErr("操作失敗");
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
      onChanged();
      onClose();
    } catch {
      setErr("取消失敗");
      setBusy(false);
    }
  }

  const active = booking.status !== "cancelled" && booking.status !== "released";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflowY: "auto",
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          minHeight: "100%",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            margin: "auto",
            width: "100%",
            maxWidth: 384,
            borderRadius: 16,
            backgroundColor: "#fff",
            padding: 20,
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {booking.memberName ?? "未知會員"}
            </p>
            <p className="text-xs text-slate-500">
              {booking.courtName ?? "場地"} · {formatDate(booking.date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-lg font-bold">
            {booking.startTime} – {booking.endTime}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {booking.durationMinutes ?? 0} 分
            </span>
          </p>
          <p className="text-slate-600">{formatPrice(booking.totalPrice)}</p>
          <p className="text-xs text-slate-400">
            收款：{PAY_LABEL[booking.paymentStatus ?? "unpaid"] ?? "未收"}
          </p>
        </div>

        {active ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => adjust(30)}
              disabled={busy || (booking.durationMinutes ?? 0) >= 240}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              ＋30 分
            </button>
            <button
              onClick={() => adjust(-30)}
              disabled={busy || (booking.durationMinutes ?? 0) <= 30}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
            >
              －30 分
            </button>
            <Link
              href={`/admin/bookings/${booking.id}/edit`}
              className="col-span-2 rounded-lg border border-emerald-300 px-3 py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              完整改單（換場 / 改時段）
            </Link>
            <button
              onClick={cancel}
              disabled={busy}
              className="col-span-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:bg-slate-100"
            >
              取消訂位
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
            此訂位已{booking.status === "cancelled" ? "取消" : "釋放"}
          </p>
        )}

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        </div>
      </div>
    </div>
  );
}
