import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getNextAvailableSlot } from "@/lib/booking";
import { getPriceRange } from "@/lib/pricing";
import { formatPrice, formatDate, weekdayOf, formatHours } from "@/lib/utils";
import CourtGallery from "@/components/CourtGallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const court = await prisma.court.findUnique({
    where: { id },
    include: { venue: true },
  });
  return {
    title: court ? `${court.venue.name} · ${court.name}` : "場地詳情",
  };
}

export default async function CourtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const court = await prisma.court.findUnique({
    where: { id },
    include: {
      venue: true,
      images: { orderBy: { sortOrder: "asc" } },
      facilities: true,
    },
  });

  if (!court || court.status !== "active" || court.venue.status !== "active") {
    notFound();
  }

  const nextSlot = await getNextAvailableSlot(court.id);
  const price = await getPriceRange(court.venueId, court.pricePerHour);
  const images = court.images.map((img) => img.url);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/courts" className="hover:text-emerald-700">
          ← 返回場地列表
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <CourtGallery images={images} />

        <div>
          <p className="text-sm font-medium text-emerald-700">
            {court.venue.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{court.name}</h1>
          <p className="mt-2 text-slate-600">
            📍 {court.venue.location ?? court.venue.name}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">時價</p>
              <p className="text-xl font-bold text-emerald-700">
                {formatPrice(price.min)}
                {price.max > price.min && ` ~ ${formatPrice(price.max)}`}
                <span className="text-sm font-normal text-slate-500">
                  {" "}
                  / 小時
                </span>
              </p>
              {price.tiers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {price.tiers.map((t) => (
                    <span
                      key={`${t.name}-${t.price}`}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {t.name} {formatPrice(t.price)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">營業時間</p>
              <p className="text-xl font-bold">
                {formatHours(court.venue.openingTime, court.venue.closingTime)}
              </p>
            </div>
          </div>

          {nextSlot && (
            <p className="mt-4 text-sm text-slate-600">
              最近可預約：
              <span className="font-medium text-emerald-700">
                {formatDate(nextSlot.date)} ({weekdayOf(nextSlot.date)}){" "}
                {nextSlot.startTime}
              </span>{" "}
              起
            </p>
          )}

          {court.description && (
            <div className="mt-6">
              <h2 className="font-semibold">場地簡介</h2>
              <p className="mt-2 text-slate-600">{court.description}</p>
            </div>
          )}

          {court.facilities.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold">設施</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {court.facilities.map((f) => (
                  <span
                    key={f.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <Link
              href={`/bookings/create?courtId=${court.id}`}
              className="block rounded-xl bg-emerald-600 px-6 py-3 text-center text-base font-semibold text-white hover:bg-emerald-700"
            >
              立即預約
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
