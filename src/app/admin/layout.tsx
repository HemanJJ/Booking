import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";

const NAV: Array<{ href: string; label: string; owner?: boolean }> = [
  { href: "/admin", label: "儀表板" },
  { href: "/desk", label: "📱 櫃台模式" },
  { href: "/admin/bookings", label: "訂位管理" },
  { href: "/admin/bookings/new", label: "代客下單" },
  { href: "/admin/schedule", label: "排班拖移" },
  { href: "/admin/recurring", label: "固定訂位" },
  { href: "/admin/import", label: "批次匯入" },
  { href: "/admin/reports", label: "報表", owner: true },
  { href: "/admin/venues", label: "場館管理", owner: true },
  { href: "/admin/courts", label: "場地管理", owner: true },
  { href: "/admin/pricing", label: "價位規則", owner: true },
  { href: "/admin/discounts", label: "時長折扣", owner: true },
  { href: "/admin/logs", label: "異動紀錄", owner: true },
  { href: "/admin/members", label: "會員管理", owner: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/account/login?returnTo=%2Fadmin");
  if (member.role !== "admin" && member.role !== "staff") redirect("/");
  const isOwner = member.role === "admin";

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
      <aside className="w-48 shrink-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {isOwner ? "管理後台" : "櫃台作業"}
          </p>
          <nav className="space-y-1">
            {NAV.filter((i) => !i.owner || isOwner).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/"
          className="mt-3 block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          ← 回前台
        </Link>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
