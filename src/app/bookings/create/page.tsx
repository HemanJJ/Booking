import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import BookingForm from "@/components/BookingForm";

export const metadata: Metadata = {
  title: "建立訂位",
};

export default async function BookingCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ courtId?: string }>;
}) {
  const { courtId } = await searchParams;
  const member = await getCurrentMember();

  if (!member) {
    const returnTo = courtId
      ? `/bookings/create?courtId=${encodeURIComponent(courtId)}`
      : "/bookings/create";
    redirect(`/account/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // 所有啟用中的場地（供頁面下拉切換）
  const courts = await prisma.court.findMany({
    where: { status: "active", venue: { status: "active" } },
    orderBy: { name: "asc" },
    include: { venue: true },
  });

  if (courts.length === 0) redirect("/courts");

  // 預設選場地：URL courtId 帶入，否則第一個
  const court =
    (courtId && courts.find((c) => c.id === courtId)) || courts[0];

  const courtData = courts.map((c) => ({
    id: c.id,
    name: c.name,
    venueName: c.venue.name,
    pricePerHour: c.pricePerHour,
    openingTime: c.venue.openingTime,
    closingTime: c.venue.closingTime,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href={`/courts/${court.id}`} className="hover:text-emerald-700">
          ← 返回場地詳情
        </Link>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">建立訂位</h1>
        <p className="mt-2 text-slate-600">
          {court.venue.name} · 選擇場地與時段
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BookingForm
          courts={courtData}
          initialCourtId={court.id}
        />
      </div>
    </div>
  );
}
