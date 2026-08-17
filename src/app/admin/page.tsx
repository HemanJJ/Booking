import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/utils";
import WeekSchedule from "@/components/WeekSchedule";

export const metadata: Metadata = {
  title: "儀表板",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: "已確認", cls: "bg-emerald-100 text-emerald-700" },
  pending: { text: "待付款", cls: "bg-amber-100 text-amber-700" },
  cancelled: { text: "已取消", cls: "bg-slate-100 text-slate-500" },
};

export default async function AdminDashboard() {
  const [venueCount, courtCount, bookingCount, memberCount, recent, courts] =
    await Promise.all([
      prisma.venue.count(),
      prisma.court.count(),
      prisma.booking.count(),
      prisma.member.count(),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          court: { include: { venue: true } },
          member: true,
        },
      }),
      prisma.court.findMany({
        orderBy: { name: "asc" },
        include: { venue: true },
      }),
    ]);

  const stats = [
    { label: "場館", value: venueCount, href: "/admin/venues" },
    { label: "場地", value: courtCount, href: "/admin/courts" },
    { label: "訂位", value: bookingCount, href: "/admin/bookings" },
    { label: "會員", value: memberCount, href: "/admin/members" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">儀表板</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow"
          >
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">週表（未來 7 日）</h2>
      <WeekSchedule
        mode="admin"
        courts={courts.map((c) => ({
          id: c.id,
          name: c.name,
          venueName: c.venue.name,
        }))}
      />

      <h2 className="mt-10 mb-4 text-lg font-semibold">最新訂位</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">尚無訂位紀錄。</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">會員</th>
                <th className="px-4 py-3 font-medium">場地</th>
                <th className="px-4 py-3 font-medium">日期時段</th>
                <th className="px-4 py-3 font-medium">金額</th>
                <th className="px-4 py-3 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => {
                const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.confirmed;
                return (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{b.member.name}</td>
                    <td className="px-4 py-3">
                      {b.court.venue.name} · {b.court.name}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(b.date)} {b.startTime}–{b.endTime}
                    </td>
                    <td className="px-4 py-3">{formatPrice(b.totalPrice)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
