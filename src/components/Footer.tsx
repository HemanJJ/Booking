"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/desk")) return null;

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">
          Dearfly 球場預約系統 — 線上預約 / 多元場地 / 安全可靠
        </p>
        <p>即將推出：專業課程、教練團隊、運動商城、最新消息。</p>
        <p className="text-xs text-slate-400">
          營業時間以各場地公告為準。本頁為系統重建示範，實際場地資訊請以現場為準。
        </p>
        <p className="text-xs text-slate-400">© 2026 迪飛羽球館 All Rights Reserved.</p>
        <p className="text-xs text-slate-400">
          System by{" "}
          <a
            href="https://linebot.my.canva.site/ai-landing-page"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline-offset-2 hover:text-slate-600"
          >
            SEQO
          </a>
        </p>
      </div>
    </footer>
  );
}
