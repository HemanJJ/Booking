import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { releaseExpiredBookings } from "@/lib/booking";
import { formatPrice, formatDate, localDateString } from "@/lib/utils";
import { toggleCashPaymentAction, adminCancelBookingAction } from "@/app/admin/actions";
import TodayOverview from "@/components/admin/TodayOverview";
import PendingSubmitButton from "@/components/PendingSubmitButton";

export const metadata: Metadata = {
  title: "儀表板",
};

// build 時不要靜態預渲染（頁面會查資料庫＋生成固定位）——只在請求時伺服器渲染
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: "已確認", cls: "bg-emerald-100 text-emerald-700" },
  pending: { text: "保留中", cls: "bg-amber-100 text-amber-700" },
  cancelled: { text: "已取消", cls: "bg-slate-100 text-slate-500" },
  released: { text: "已釋放", cls: "bg-rose-100 text-rose-600" },
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "未收",
  cash: "已收現金",
  linepay: "LINE Pay",
  points: "點數",
};

export default async function AdminDashboard() {
  // 釋放逾期訂位（快）。固定位改由「每日 cron＋新增/編輯/恢復固定位」生成，避免每次開後台都慢。
  await releaseExpiredBookings();

  const today = localDateString(new Date());
  const [courts, todayBookings, recent] = await Promise.all([
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
    prisma.booking.findMany({
      where: { date: today, status: { notIn: ["cancelled", "released"] } },
      include: { member: true },
    }),
    prisma.booking.findMany({
      take: 8,
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: { court: { include: { venue: true } }, member: true },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">儀表板</h1>
          <p className="mt-1 text-sm text-slate-500">
            {today} 現況總覽
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/schedule"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            排班拖移
          </Link>
          <Link
            href="/admin/bookings/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            ＋ 代客下單
          </Link>
        </div>
      </div>

      <TodayOverview
        courts={courts.map((c) => ({
          id: c.id,
          name: c.name,
          venueName: c.venue.name,
          openingTime: c.venue.openingTime,
          closingTime: c.venue.closingTime,
        }))}
        today={today}
        initialBookings={todayBookings.map((b) => ({
          id: b.id,
          courtId: b.courtId,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          totalPrice: b.totalPrice,
          memberName: b.member.name,
          paymentStatus: b.paymentStatus,
          durationMinutes: b.durationMinutes,
        }))}
      />

      <h2 className="mt-10 mb-4 text-lg font-semibold">最新訂位</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">尚無訂位紀錄。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">會員</th>
                  <th className="px-4 py-3 font-medium">場地</th>
                  <th className="px-4 py-3 font-medium">日期時段</th>
                  <th className="px-4 py-3 font-medium">金額</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                  <th className="px-4 py-3 font-medium">收款</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => {
                  const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.confirmed;
                  const active =
                    b.status !== "cancelled" && b.status !== "released";
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
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">
                          {PAYMENT_LABEL[b.paymentStatus] ?? "未收"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {active && (
                            <>
                              <form action={toggleCashPaymentAction}>
                                <input type="hidden" name="id" value={b.id} />
                                <PendingSubmitButton
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                    b.paymentStatus === "cash"
                                      ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {b.paymentStatus === "cash"
                                    ? "改回未收"
                                    : "標已收現金"}
                                </PendingSubmitButton>
                              </form>
                              <Link
                                href={`/admin/bookings/${b.id}/edit`}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                改單
                              </Link>
                              <form action={adminCancelBookingAction}>
                                <input type="hidden" name="id" value={b.id} />
                                <PendingSubmitButton className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                                  取消
                                </PendingSubmitButton>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
