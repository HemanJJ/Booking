import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { localDateString } from "@/lib/utils";
import { resolveSlotPrice, type PriceRuleLike } from "@/lib/pricing";
import { releaseExpiredBookings } from "@/lib/booking";

/** 由開始時間＋時長還原該訂位佔用的 30 分時段起點 */
function slotStarts(startTime: string, durationMinutes: number): string[] {
  const [h, m] = startTime.split(":").map(Number);
  const count = Math.max(1, Math.round(durationMinutes / 30));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const mins = h * 60 + m + i * 30;
    out.push(
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
    );
  }
  return out;
}

/**
 * 週表資料：查詢某段日期區間（預設 7 天）的訂位。
 * - 管理員：附帶訂位者姓名、總價，以及依「現行價位規則」重新解析的
 *   平均每小時價（avgHourlyPrice）供色塊上色。
 * - 一般訪客/會員：只回傳「哪面場、哪時段被佔用」，不暴露姓名與價格。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const days = Math.min(
    Math.max(Number(url.searchParams.get("days") ?? "7") || 7, 1),
    31
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "start 參數錯誤" }, { status: 400 });
  }

  // 惰性清理：釋放逾期未付款訂位，確保時段正確反映
  await releaseExpiredBookings();

  const [y, m, d] = start.split("-").map(Number);
  const end = localDateString(new Date(y, m - 1, d + days - 1));

  const current = await getCurrentMember();
  const isAdmin = current?.role === "admin" || current?.role === "staff";

  const bookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["cancelled", "released"] },
      date: { gte: start, lte: end },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { court: { include: { venue: true } }, member: true },
  });

  // 一次取出現行價位規則，按場館分組，避免逐筆查詢
  const allRules = await prisma.priceRule.findMany({
    where: { active: "active" },
    select: {
      venueId: true,
      name: true,
      kind: true,
      price: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      date: true,
    },
  });
  const rulesByVenue = new Map<string, PriceRuleLike[]>();
  for (const r of allRules) {
    const list = rulesByVenue.get(r.venueId) ?? [];
    list.push(r);
    rulesByVenue.set(r.venueId, list);
  }

  return NextResponse.json({
    start,
    end,
    bookings: bookings.map((b) => {
      const rules = rulesByVenue.get(b.court.venueId) ?? [];
      const starts = slotStarts(b.startTime, b.durationMinutes);
      const avg = starts.length
        ? Math.round(
            starts.reduce(
              (sum, t) =>
                sum + resolveSlotPrice(rules, b.date, t, b.court.pricePerHour),
              0
            ) / starts.length
          )
        : b.court.pricePerHour;

      return {
        id: b.id,
        courtId: b.courtId,
        courtName: b.court.name,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        status: b.status,
        paymentStatus: isAdmin ? b.paymentStatus : undefined,
        memberName: isAdmin ? b.member.name : undefined,
        totalPrice: isAdmin ? b.totalPrice : undefined,
        avgHourlyPrice: isAdmin ? avg : undefined,
      };
    }),
  });
}
