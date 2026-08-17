import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getNextAvailableSlot } from "@/lib/booking";
import { getPriceRange } from "@/lib/pricing";
import CourtListView from "@/components/CourtListView";

export const metadata: Metadata = {
  title: "場地列表",
};

export default async function CourtsPage() {
  const courts = await prisma.court.findMany({
    where: { status: "active", venue: { status: "active" } },
    orderBy: { name: "asc" },
    include: {
      venue: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      facilities: true,
    },
  });

  const data = await Promise.all(
    courts.map(async (c) => {
      const range = await getPriceRange(c.venueId, c.pricePerHour);
      return {
        id: c.id,
        name: c.name,
        venueName: c.venue.name,
        location: c.venue.location,
        pricePerHour: c.pricePerHour,
        priceMin: range.min,
        priceMax: range.max,
        openingTime: c.venue.openingTime,
        closingTime: c.venue.closingTime,
        thumbnail: c.images[0]?.url ?? null,
        facilities: c.facilities.map((f) => f.name),
        nextSlot: await getNextAvailableSlot(c.id),
      };
    })
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">場地列表</h1>
        <p className="mt-2 text-slate-600">
          挑選喜歡的場地，查看詳情與可預約時段。
        </p>
      </div>
      <CourtListView courts={data} />
    </div>
  );
}
