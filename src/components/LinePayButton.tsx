"use client";

import { useState } from "react";

export default function LinePayButton({
  bookingId,
  enabled,
}: {
  bookingId: string;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!enabled) {
    return (
      <p className="text-xs text-slate-400">
        LINE Pay 尚未開通，請至櫃檯繳費
      </p>
    );
  }

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/linepay/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error ?? "付款請求失敗");
      }
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "付款請求失敗");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={pay}
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
      >
        {loading ? "跳轉中…" : "LINE Pay 付款"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
