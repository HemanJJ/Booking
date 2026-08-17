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

  const court = courtId
    ? await prisma.court.findUnique({
        where: { id: courtId },
        include: { venue: true },
      })
    : null;

  if (!court || court.status !== "active") {
    redirect("/courts");
  }

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
          {court.venue.name} · {court.name}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BookingForm
          court={{
            id: court.id,
            name: court.name,
            venueName: court.venue.name,
            pricePerHour: court.pricePerHour,
            openingTime: court.venue.openingTime,
            closingTime: court.venue.closingTime,
          }}
        />
      </div>
    </div>
  );
}
