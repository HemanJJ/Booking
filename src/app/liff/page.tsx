"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    liff?: {
      init: (opt: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
    };
  }
}

/**
 * LIFF 入口：Rich Menu「預訂場地」→ LINE 內開啟此頁 → 自動登入 → 導向訂位。
 * 需要環境變數 NEXT_PUBLIC_LIFF_ID（LINE Login channel 下的 LIFF App ID）。
 */
export default function LiffLoginPage() {
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      window.location.href = "/account/login";
      return;
    }

    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.onload = () => {
      const liff = window.liff;
      if (!liff) {
        window.location.href = "/account/login";
        return;
      }
      liff
        .init({ liffId })
        .then(() => {
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }
          const idToken = liff.getIDToken();
          if (!idToken) {
            window.location.href = "/account/login";
            return;
          }
          return fetch("/api/auth/line/liff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          })
            .then((r) => r.json())
            .then((d) => {
              window.location.href = d?.ok ? "/bookings" : "/account/login";
            });
        })
        .catch(() => {
          window.location.href = "/account/login";
        });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-16 text-center">
      <div>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-slate-600">正在以 LINE 登入…</p>
      </div>
    </div>
  );
}
