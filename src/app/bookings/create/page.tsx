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

  // 所有啟用中的分店（含場地）
  const venuesWithCourts = await prisma.venue.findMany({
    where: { status: "active", courts: { some: { status: "active" } } },
    orderBy: { createdAt: "asc" },
    include: { courts: { where: { status: "active" }, orderBy: { name: "asc" } } },
  });

  if (venuesWithCourts.length === 0) redirect("/courts");

  // 所有場地（跨分店，供表單切換）
  const allCourts = venuesWithCourts.flatMap((v) =>
    v.courts.map((c) => ({
      id: c.id,
      name: c.name,
      venueId: v.id,
      venueName: v.name,
      pricePerHour: c.pricePerHour,
      openingTime: v.openingTime,
      closingTime: v.closingTime,
    }))
  );

  // 預設選場地：URL courtId 帶入，否則第一個場地
  const initialCourt =
    (courtId && allCourts.find((c) => c.id === courtId)) || allCourts[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/schedule" className="hover:text-emerald-700">
          ← 查閱場地（看空檔）
        </Link>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">建立訂位</h1>
        <p className="mt-2 text-slate-600">
          選擇分店與場地，快速訂位
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BookingForm
          venues={venuesWithCourts.map((v) => ({
            id: v.id,
            name: v.name,
            courts: v.courts.map((c) => ({
              id: c.id,
              name: c.name,
              pricePerHour: c.pricePerHour,
              openingTime: v.openingTime,
              closingTime: v.closingTime,
            })),
          }))}
          initialCourtId={initialCourt.id}
        />
      </div>
    </div>
  );
}
