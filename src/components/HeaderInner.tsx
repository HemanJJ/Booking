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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dearfly-logo.png"
            alt="Dearfly"
            className="h-10 w-auto"
          />
          <span className="hidden text-lg font-bold text-emerald-700 sm:inline">
            Dearfly 球場預約
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 text-sm font-medium">
          <Link
            href="/courts"
            className="whitespace-nowrap rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100 sm:px-3"
          >
            <span className="sm:hidden">預約</span>
            <span className="hidden sm:inline">場館預約</span>
          </Link>
          <Link
            href="/schedule"
            className="whitespace-nowrap rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100 sm:px-3"
          >
            <span className="sm:hidden">場地</span>
            <span className="hidden sm:inline">查閱場地</span>
          </Link>
          <Link
            href="/bookings"
            className="whitespace-nowrap rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100 sm:px-3"
          >
            <span className="sm:hidden">訂位</span>
            <span className="hidden sm:inline">我的訂位</span>
          </Link>
          {member && (
            <Link
              href="/account/password"
              className="whitespace-nowrap rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100 sm:px-3"
            >
              <span className="sm:hidden">密碼</span>
              <span className="hidden sm:inline">修改密碼</span>
            </Link>
          )}
          {(member?.role === "admin" || member?.role === "staff") && (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-md px-2 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 sm:px-3"
            >
              <span className="sm:hidden">後台</span>
              <span className="hidden sm:inline">管理後台</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          {member ? (
            <>
              <span className="hidden text-slate-600 sm:inline">
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
                href="/courts"
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
