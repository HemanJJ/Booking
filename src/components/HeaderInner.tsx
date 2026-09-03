"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export type HeaderMember = {
  id: string;
  name: string;
  role: string;
} | null;

/** 路徑 /desk 開頭＝櫃台模式全螢幕，隱藏 Header */
export default function HeaderInner({ member }: { member: HeaderMember }) {
  const pathname = usePathname();
  if (pathname.startsWith("/desk")) return null;

  // 依目前路徑高亮：現在在看哪個功能，就讓它變綠（不再寫死）
  const navCls = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 ${
      on
        ? "font-semibold text-emerald-700 bg-emerald-50"
        : "text-slate-700 hover:bg-slate-100"
    }`;
  const onBookingCreate = pathname.startsWith("/bookings/create");
  const onSchedule = pathname.startsWith("/schedule");
  const onBookings =
    pathname.startsWith("/bookings") && !onBookingCreate;
  const onPassword = pathname.startsWith("/account/password");
  const onAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      {/* 用原生 media query 控制「手机短标签 / 电脑长标签」，不依賴 Tailwind responsive class（Tailwind v4 在部分浏览不生效） */}
      <style>{`
        @media (max-width: 639px) { .nav-full { display: none; } }
        @media (min-width: 640px)  { .nav-short { display: none; } }
      `}</style>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dearfly-logo.png"
            alt="Dearfly"
            className="h-9 w-auto"
          />
          <span className="hidden text-lg font-bold text-emerald-700 lg:inline">
            Dearfly 球場預約
          </span>
        </Link>

        {/* nav：ml-auto 推到右，寬度自然，太多時橫向滾動，每按鈕不壓縮 */}
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm font-medium sm:ml-auto">
          <Link
            href="/bookings/create"
            className={navCls(onBookingCreate)}
          >
            <span className="nav-short">預約</span>
            <span className="nav-full">場館預約</span>
          </Link>
          <Link
            href="/schedule"
            className={navCls(onSchedule)}
          >
            <span className="nav-short">場地</span>
            <span className="nav-full">查閱場地</span>
          </Link>
          <Link
            href="/bookings"
            className={navCls(onBookings)}
          >
            <span className="nav-short">訂位</span>
            <span className="nav-full">我的訂位</span>
          </Link>
          {member && (
            <Link
              href="/account/password"
              className={navCls(onPassword)}
            >
              <span className="nav-short">密碼</span>
              <span className="nav-full">修改密碼</span>
            </Link>
          )}
          {(member?.role === "admin" || member?.role === "staff") && (
            <Link
              href="/admin"
              className={navCls(onAdmin)}
            >
              <span className="nav-short">後台</span>
              <span className="nav-full">管理後台</span>
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          {member ? (
            <>
              <span className="hidden text-slate-600 md:inline">
                Hi, {member.name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/account/login"
                className="rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
              >
                登入
              </Link>
              <Link
                href="/bookings/create"
                className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700"
              >
                立即預約
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
