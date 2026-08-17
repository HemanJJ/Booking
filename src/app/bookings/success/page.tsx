import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate, formatDuration, weekdayOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: "訂位成功",
};

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { court: { include: { venue: true } } },
  });

  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">
        ✅
      </div>
      <h1 className="mt-6 text-2xl font-bold">訂位成功！</h1>
      <p className="mt-2 text-slate-600">
        我們已為您保留場地時段，請準時到場。
      </p>

      <div className="mt-8 space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-left text-sm">
        <Row
          label="場地"
          value={`${booking.court.venue.name} · ${booking.court.name}`}
        />
        <Row label="日期" value={`${formatDate(booking.date)} (${weekdayOf(booking.date)})`} />
        <Row label="時段" value={`${booking.startTime} – ${booking.endTime}`} />
        <Row label="時長" value={formatDuration(booking.durationMinutes)} />
        <Row label="金額" value={formatPrice(booking.totalPrice)} />
        <Row label="訂單編號" value={booking.id} />
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/bookings"
          className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          查看我的訂位
        </Link>
        <Link
          href="/courts"
          className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-100"
        >
          繼續預約
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
