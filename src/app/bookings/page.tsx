import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { formatPrice, formatDate, formatDuration, weekdayOf } from "@/lib/utils";
import { linePayConfigured } from "@/lib/linepay";
import CancelButton from "@/components/CancelButton";
import LinePayButton from "@/components/LinePayButton";

export const metadata: Metadata = {
  title: "我的訂位",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: "已確認", cls: "bg-emerald-100 text-emerald-700" },
  pending: { text: "保留中・待付款", cls: "bg-amber-100 text-amber-700" },
  cancelled: { text: "已取消", cls: "bg-slate-100 text-slate-500" },
  released: { text: "已釋放", cls: "bg-rose-100 text-rose-600" },
};

export default async function MyBookingsPage() {
  const member = await getCurrentMember();
  if (!member) {
    redirect("/account/login?returnTo=%2Fbookings");
  }

  const bookings = await prisma.booking.findMany({
    where: { memberId: member.id },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    include: { court: { include: { venue: true } } },
  });

  const linePayEnabled = linePayConfigured();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的訂位</h1>
          <p className="mt-2 text-slate-600">
            Hi, {member.name} — 這裡列出您的所有訂位紀錄。
          </p>
        </div>
        <Link
          href="/courts"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 新增預約
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">尚無訂位紀錄。</p>
          <Link
            href="/courts"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            去逛逛場地
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.confirmed;
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/courts/${b.court.id}`}
                      className="text-lg font-semibold hover:text-emerald-700"
                    >
                      {b.court.venue.name} · {b.court.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(b.date)} ({weekdayOf(b.date)}) ·{" "}
                      {b.startTime} – {b.endTime} ·{" "}
                      {formatDuration(b.durationMinutes)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      訂單編號：{b.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-emerald-700">
                      {formatPrice(b.totalPrice)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${s.cls}`}
                    >
                      {s.text}
                    </span>
                    {b.status === "pending" && (
                      <>
                        <span className="text-xs text-amber-600">
                          請於 24 小時內繳費，否則時段自動釋放
                        </span>
                        <LinePayButton bookingId={b.id} enabled={linePayEnabled} />
                      </>
                    )}
                    {b.status !== "cancelled" && b.status !== "released" && (
                      <CancelButton bookingId={b.id} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
