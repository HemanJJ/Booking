import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const member = await getCurrentMember();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-emerald-700"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white">
            D
          </span>
          <span className="hidden sm:inline">DiFly 球場預約</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/courts"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            場館預約
          </Link>
          <Link
            href="/schedule"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            查閱場地
          </Link>
          <Link
            href="/bookings"
            className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
          >
            我的訂位
          </Link>
          {member?.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              管理後台
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
