import { prisma } from "./prisma";
import { localDateString } from "./utils";
import { getActiveRules, resolveSlotPrice, computeBookingTotal } from "./pricing";

/** 預約最小單位（分鐘） */
export const SLOT_MINUTES = 30;
/** 單筆訂位最短 / 最長（分鐘） */
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 240; // 4 小時

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 依營業時間產生每 30 分鐘的時段起點（"HH:MM"） */
export function generateSlotStarts(
  openingTime: string,
  closingTime: string
): string[] {
  const open = toMinutes(openingTime);
  const close = toMinutes(closingTime);
  const slots: string[] = [];
  for (let t = open; t + SLOT_MINUTES <= close; t += SLOT_MINUTES) {
    slots.push(toHHMM(t));
  }
  return slots;
}

/** 該日期時段是否已過去（伺服器本地時間） */
function isPast(date: string, startTime: string): boolean {
  const now = new Date();
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = startTime.split(":").map(Number);
  const slotDate = new Date(y, m - 1, d, hh, mm);
  return slotDate.getTime() <= now.getTime();
}

export type SlotInfo = {
  startTime: string;
  available: boolean;
  hourlyPrice: number;
};

/** 取得某場地某日的時段清單（含是否可預約；營業時間取場館） */
export async function getSlotsForDate(
  courtId: string,
  date: string
): Promise<SlotInfo[]> {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { venue: true },
  });
  if (!court) return [];
  const starts = generateSlotStarts(
    court.venue.openingTime,
    court.venue.closingTime
  );
  const [booked, rules] = await Promise.all([
    prisma.bookingSlot.findMany({
      where: { courtId, date },
      select: { startTime: true },
    }),
    getActiveRules(court.venueId),
  ]);
  const bookedSet = new Set(booked.map((b) => b.startTime));
  return starts.map((startTime) => ({
    startTime,
    available: !bookedSet.has(startTime) && !isPast(date, startTime),
    hourlyPrice: resolveSlotPrice(rules, date, startTime, court.pricePerHour),
  }));
}

/** 找出最近可預約時間（今天起往後 14 天） */
export async function getNextAvailableSlot(
  courtId: string
): Promise<{ date: string; startTime: string } | null> {
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = localDateString(d);
    const slots = await getSlotsForDate(courtId, date);
    const first = slots.find((s) => s.available);
    if (first) return { date, startTime: first.startTime };
  }
  return null;
}

export type CreateBookingInput = {
  courtId: string;
  memberId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
};

/**
 * 建立訂位（核心）
 * BookingSlot 的 @@unique([courtId, date, startTime]) 在資料庫層級
 * 保證同一場地同一時段無法重複預訂——即便同時有多筆請求競爭亦然。
 */
export async function createBooking(input: CreateBookingInput): Promise<{
  id: string;
  venueName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
}> {
  const court = await prisma.court.findUnique({
    where: { id: input.courtId },
    include: { venue: true },
  });
  if (!court || court.status !== "active") {
    throw new Error("場地不存在或未開放");
  }
  if (court.venue.status !== "active") {
    throw new Error("場館未開放");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("日期格式錯誤");
  }
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) {
    throw new Error("時段格式錯誤");
  }

  const duration = Math.floor(Number(input.durationMinutes));
  if (
    !Number.isInteger(duration) ||
    duration < MIN_DURATION_MINUTES ||
    duration > MAX_DURATION_MINUTES ||
    duration % SLOT_MINUTES !== 0
  ) {
    throw new Error(
      `預約長度須為 30 分鐘的倍數，且介於 ${MIN_DURATION_MINUTES / 60}~${MAX_DURATION_MINUTES / 60} 小時`
    );
  }

  const startMin = toMinutes(input.startTime);
  const openMin = toMinutes(court.venue.openingTime);
  const closeMin = toMinutes(court.venue.closingTime);
  if (startMin < openMin || startMin + duration > closeMin) {
    throw new Error("超出場館營業時間");
  }
  if (isPast(input.date, input.startTime)) {
    throw new Error("不可預訂過去的時段");
  }

  const slotCount = duration / SLOT_MINUTES;
  const slotStarts: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    slotStarts.push(toHHMM(startMin + i * SLOT_MINUTES));
  }
  const endTime = toHHMM(startMin + duration);
  const { total: totalPrice, discountTotal } = await computeBookingTotal(
    court.venueId,
    input.date,
    slotStarts,
    court.pricePerHour
  );

  try {
    const booking = await prisma.$transaction(async (tx) => {
      return tx.booking.create({
        data: {
          courtId: court.id,
          memberId: input.memberId,
          date: input.date,
          startTime: input.startTime,
          endTime,
          durationMinutes: duration,
          totalPrice,
          discountAmount: discountTotal,
          status: "confirmed",
          slots: {
            create: slotStarts.map((startTime) => ({
              courtId: court.id,
              date: input.date,
              startTime,
            })),
          },
        },
        select: { id: true },
      });
    });
    return {
      id: booking.id,
      venueName: court.venue.name,
      courtName: court.name,
      date: input.date,
      startTime: input.startTime,
      endTime,
      totalPrice,
    };
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("該時段已被預訂，請重新選擇");
    }
    throw e;
  }
}

/** 取消訂位並釋放時段 */
export async function cancelBooking(
  bookingId: string,
  memberId: string
): Promise<{
  venueName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
}> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, memberId, status: { not: "cancelled" } },
    include: { court: { include: { venue: true } } },
  });
  if (!booking) throw new Error("訂位不存在或已取消");

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    await tx.bookingSlot.deleteMany({ where: { bookingId: booking.id } });
  });

  return {
    venueName: booking.court.venue.name,
    courtName: booking.court.name,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2002"
  );
}
