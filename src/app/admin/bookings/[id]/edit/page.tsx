import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminEditBookingForm from "@/components/admin/AdminEditBookingForm";

export const metadata: Metadata = {
  title: "改單",
};

export default async function AdminEditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [booking, courts] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: { member: true },
    }),
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
  ]);

  if (!booking) notFound();
  if (booking.status === "cancelled" || booking.status === "released") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">改單</h1>
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          此訂位已取消或已釋放，無法修改。
        </p>
        <Link
          href="/admin/bookings"
          className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← 回訂位管理
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">改單</h1>
          <p className="mt-1 text-sm text-slate-500">
            客人：{booking.member.name}
          </p>
        </div>
        <Link
          href="/admin/bookings"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← 回訂位管理
        </Link>
      </div>

      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AdminEditBookingForm
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            venueName: c.venue.name,
            pricePerHour: c.pricePerHour,
          }))}
          booking={{
            id: booking.id,
            courtId: booking.courtId,
            date: booking.date,
            startTime: booking.startTime,
            durationMinutes: booking.durationMinutes,
            memberName: booking.member.name,
          }}
        />
      </div>
    </div>
  );
}
