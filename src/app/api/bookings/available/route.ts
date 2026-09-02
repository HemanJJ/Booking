import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSlotsForDate, releaseExpiredBookings } from "@/lib/booking";
import { getActiveDiscounts } from "@/lib/pricing";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const courtId = url.searchParams.get("courtId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const excludeBookingId = url.searchParams.get("excludeBookingId") ?? undefined;

  if (!courtId || !date) {
    return NextResponse.json({ error: "參數不足" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日期格式錯誤" }, { status: 400 });
  }

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { venue: true },
  });
  if (!court) {
    return NextResponse.json({ error: "場地不存在" }, { status: 404 });
  }

  // 惰性清理：釋放逾期未付款訂位
  await releaseExpiredBookings();

  const [slots, discounts] = await Promise.all([
    getSlotsForDate(courtId, date, excludeBookingId),
    getActiveDiscounts(court.venueId),
  ]);
  // 禁止快取：避免切換場地/日期時瀏覽器 or Vercel 回送舊的「可訂」狀態
  const resp = NextResponse.json({
    court: {
      id: court.id,
      name: court.name,
      venueName: court.venue.name,
      pricePerHour: court.pricePerHour,
      openingTime: court.venue.openingTime,
      closingTime: court.venue.closingTime,
    },
    slots,
    discounts,
  });
  resp.headers.set("Cache-Control", "no-store, max-age=0");
  return resp;
}
