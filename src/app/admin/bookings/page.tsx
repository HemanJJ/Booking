import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminCancelBookingAction } from "@/app/admin/actions";
import { formatPrice, formatDate, formatDuration, weekdayOf } from "@/lib/utils";
import WeekSchedule from "@/components/WeekSchedule";

export const metadata: Metadata = {
  title: "訂位管理",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: "已確認", cls: "bg-emerald-100 text-emerald-700" },
  pending: { text: "待付款", cls: "bg-amber-100 text-amber-700" },
  cancelled: { text: "已取消", cls: "bg-slate-100 text-slate-500" },
};

export default async function AdminBookingsPage() {
  const [bookings, courts] = await Promise.all([
    prisma.booking.findMany({
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">訂位管理</h1>

      <div className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">週表（未來 7 日）</h2>
        <WeekSchedule
          mode="admin"
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            venueName: c.venue.name,
          }))}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">訂位列表</h2>

      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無訂位。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">會員</th>
                <th className="px-4 py-3 font-medium">場地</th>
                <th className="px-4 py-3 font-medium">日期時段</th>
                <th className="px-4 py-3 font-medium">金額</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.confirmed;
                return (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.member.name}</p>
                      <p className="text-xs text-slate-400">
                        {b.member.email ?? b.member.lineName ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {b.court.venue.name} · {b.court.name}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(b.date)} ({weekdayOf(b.date)}){" "}
                      {b.startTime}–{b.endTime} ·{" "}
                      {formatDuration(b.durationMinutes)}
                    </td>
                    <td className="px-4 py-3">{formatPrice(b.totalPrice)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}
                      >
                        {s.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status !== "cancelled" && (
                        <form action={adminCancelBookingAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            取消訂位
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
