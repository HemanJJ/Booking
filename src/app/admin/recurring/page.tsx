import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { stopRecurringBookingAction } from "@/app/admin/actions";
import { formatDate, weekdayOf, formatDuration } from "@/lib/utils";
import RecurringForm from "@/components/admin/RecurringForm";

export const metadata: Metadata = {
  title: "固定訂位",
};

const DOW_TEXT = ["日", "一", "二", "三", "四", "五", "六"];

export default async function AdminRecurringPage() {
  const [courts, members, rules] = await Promise.all([
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
    prisma.member.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.recurringBooking.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { court: { include: { venue: true } }, member: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">固定訂位（每週固定團）</h1>
      <p className="mb-6 text-sm text-slate-500">
        設一次，系統每天自動生成未來 4 週的訂位；某週被佔會自動跳過並通知你。
      </p>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">＋ 新增固定訂位</h2>
        <RecurringForm
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            venueName: c.venue.name,
          }))}
          members={members}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">現有固定訂位</h2>
      {rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無固定訂位。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">會員</th>
                <th className="px-4 py-3 font-medium">場地</th>
                <th className="px-4 py-3 font-medium">週期</th>
                <th className="px-4 py-3 font-medium">時段</th>
                <th className="px-4 py-3 font-medium">起訖</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{r.member.name}</td>
                  <td className="px-4 py-3">
                    {r.court.venue.name} · {r.court.name}
                  </td>
                  <td className="px-4 py-3">每週{DOW_TEXT[r.dayOfWeek]}</td>
                  <td className="px-4 py-3">
                    {r.startTime} · {formatDuration(r.durationMinutes)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(r.startDate)} ~{" "}
                    {r.endDate ? formatDate(r.endDate) : "長期"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "active" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        進行中
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        已停止
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "active" && (
                      <form action={stopRecurringBookingAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          停止系列
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
