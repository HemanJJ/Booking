import { prisma } from "./prisma";
import { localDateString, nextDates, TAIWAN_OFFSET_MS } from "./utils";
import { getActiveRules, resolveSlotPrice, computeBookingTotal } from "./pricing";
import { logBookingEvent } from "./audit";
import { sendLineAdminNotify } from "./notify";

/** 預約最小單位（分鐘） */
export const SLOT_MINUTES = 30;
/** 單筆訂位最短 / 最長（分鐘） */
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 240; // 4 小時
/** 保留時長（小時）：訂位建立後須在此期限內繳費，否則自動釋放時段 */
export const RESERVATION_HOLD_HOURS = 24;

export type PaymentMethod = "cash" | "linepay" | "points";

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

/** 該日期時段是否已過去（以台灣時區 Asia/Taipei 判定） */
function isPast(date: string, startTime: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = startTime.split(":").map(Number);
  // 台灣牆鐘時間 → UTC 毫秒（Taiwan = UTC+8）
  const slotUtcMs = Date.UTC(y, m - 1, d, hh, mm) - TAIWAN_OFFSET_MS;
  return slotUtcMs <= Date.now();
}

export type SlotInfo = {
  startTime: string;
  available: boolean;
  hourlyPrice: number;
};

/** 取得某場地某日的時段清單（含是否可預約；營業時間取場館）
 *  @param excludeBookingId 改單時傳入，忽略該筆訂位自己佔用的時段（視為可選）
 */
export async function getSlotsForDate(
  courtId: string,
  date: string,
  excludeBookingId?: string
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
      where: {
        courtId,
        date,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      },
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
  for (const date of nextDates(14)) {
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
  source?: "member" | "admin" | "phone" | "recurring";
  note?: string | null;
  confirmed?: boolean; // true = 直接「已確認」（固定訂位用，不走 24h 保留）
  recurringId?: string | null;
  allowPast?: boolean; // 批次補登過去訂位用（跳過過去時段檢查）
};

/** 依場地＋日期＋時段＋時長，驗證並計算時段與價錢（create/update 共用）
 *  @param allowPast 批次補登過去訂位時設 true（跳過「不可預訂過去時段」檢查）
 */
async function prepareBooking(
  courtId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  allowPast = false
) {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { venue: true },
  });
  if (!court || court.status !== "active") {
    throw new Error("場地不存在或未開放");
  }
  if (court.venue.status !== "active") {
    throw new Error("場館未開放");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式錯誤");
  }
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error("時段格式錯誤");
  }

  const duration = Math.floor(Number(durationMinutes));
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

  const startMin = toMinutes(startTime);
  const openMin = toMinutes(court.venue.openingTime);
  const closeMin = toMinutes(court.venue.closingTime);
  if (startMin < openMin || startMin + duration > closeMin) {
    throw new Error("超出場館營業時間");
  }
  if (!allowPast && isPast(date, startTime)) {
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
    date,
    slotStarts,
    court.pricePerHour
  );
  return { court, duration, slotStarts, endTime, totalPrice, discountTotal };
}

/**
 * 建立訂位（核心）
 * - 訂位建立即為「保留中」（pending），先佔住時段，24 小時內繳費否則釋放。
 * - BookingSlot 的 @@unique([courtId, date, startTime]) 在資料庫層級
 *   保證同一場地同一時段無法重複預訂——即便同時有多筆請求競爭亦然。
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
  const { court, duration, slotStarts, endTime, totalPrice, discountTotal } =
    await prepareBooking(
      input.courtId,
      input.date,
      input.startTime,
      input.durationMinutes,
      input.allowPast ?? false
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
          status: input.confirmed ? "confirmed" : "pending",
          paymentStatus: "unpaid",
          reservedAt: input.confirmed ? null : new Date(),
          source: input.source ?? "member",
          note: input.note ?? null,
          recurringId: input.recurringId ?? null,
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

export type UpdateBookingInput = {
  bookingId: string;
  courtId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  allowPast?: boolean; // 調整時長等後台補登用（跳過「過去時段」檢查）
};

/** 改單：換時段 / 改時長 / 換面場（沿用資料庫層級防重疊） */
export async function updateBooking(input: UpdateBookingInput): Promise<{
  id: string;
  venueName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
}> {
  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
  });
  if (!existing) throw new Error("訂位不存在");
  if (existing.status === "cancelled" || existing.status === "released") {
    throw new Error("已取消或已釋放的訂位無法修改");
  }

  const { court, duration, slotStarts, endTime, totalPrice, discountTotal } =
    await prepareBooking(
      input.courtId,
      input.date,
      input.startTime,
      input.durationMinutes,
      input.allowPast ?? false
    );

  try {
    await prisma.$transaction(async (tx) => {
      // 先刪舊時段、再建新時段；若新時段被佔，交易回滾，舊時段保留
      await tx.bookingSlot.deleteMany({ where: { bookingId: input.bookingId } });
      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          courtId: court.id,
          date: input.date,
          startTime: input.startTime,
          endTime,
          durationMinutes: duration,
          totalPrice,
          discountAmount: discountTotal,
          slots: {
            create: slotStarts.map((startTime) => ({
              courtId: court.id,
              date: input.date,
              startTime,
            })),
          },
        },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("目標時段已被預訂，請重新選擇");
    }
    throw e;
  }

  return {
    id: input.bookingId,
    venueName: court.venue.name,
    courtName: court.name,
    date: input.date,
    startTime: input.startTime,
    endTime,
    totalPrice,
  };
}

/** 收款 / 扣點數：確認訂位並記錄付款狀態 */
export async function markBookingPaid(
  bookingId: string,
  method: PaymentMethod
): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("訂位不存在");
  if (booking.status === "cancelled" || booking.status === "released") {
    throw new Error("已取消或已釋放的訂位無法收款");
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "confirmed", paymentStatus: method, paidAt: new Date() },
  });
}

/** 退回未收款（把已收現金改回未收；狀態維持已確認，不回到保留中） */
export async function markBookingUnpaid(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("訂位不存在");
  if (booking.status === "cancelled" || booking.status === "released") {
    throw new Error("已取消或已釋放的訂位無法修改");
  }
  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "unpaid", paidAt: null },
  });
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

/**
 * 釋放逾期的「保留中」訂位（超過 24 小時未繳費）。
 * 因 serverless 無常駐背景工作，採「惰性清理」：在讀取（儀表板/時間軸/列表）
 * 時呼叫，確保逾期訂位即時釋放時段；亦可由 cron route 定期觸發。
 * 回傳本次釋放的筆數。
 */
export async function releaseExpiredBookings(): Promise<number> {
  const cutoff = new Date(
    Date.now() - RESERVATION_HOLD_HOURS * 60 * 60 * 1000
  );
  const expired = await prisma.booking.findMany({
    where: {
      status: "pending",
      OR: [
        { reservedAt: { lt: cutoff } },
        { reservedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  for (const b of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: b.id },
        data: { status: "released" },
      });
      await tx.bookingSlot.deleteMany({ where: { bookingId: b.id } });
    });
    await logBookingEvent({
      bookingId: b.id,
      actorName: "系統",
      action: "release",
      detail: `逾時未付款自動釋放｜${b.date} ${b.startTime}-${b.endTime}`,
    });
  }
  return expired.length;
}

/** 固定位衝突通知去重間隔（同規則 1 小時內不重複吵） */
const CONFLICT_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

const DOW_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

/**
 * 生成「未來 4 週」的固定訂位（每週固定團）。
 * 每個活躍的 RecurringBooking，往後 28 天中符合「星期幾＋起訖」的日子，
 * 若尚未生成且時段未被佔，就建一筆「已確認・未收款」的 Booking。
 * 被佔的週次：不再靜默——回報 conflicts 給呼叫端，並（去重）LINE 通知老闆。
 * 回傳本次新生成筆數與衝突清單。
 */
export async function generateRecurringBookings(): Promise<{
  created: number;
  conflicts: {
    ruleId: string;
    date: string;
    startTime: string;
    endTime: string;
    dayOfWeek: number;
    memberName: string;
    courtName: string;
  }[];
}> {
  const rules = await prisma.recurringBooking.findMany({
    where: { status: "active" },
    include: { court: true, member: true },
  });
  let created = 0;
  const conflicts: {
    ruleId: string;
    date: string;
    startTime: string;
    endTime: string;
    dayOfWeek: number;
    memberName: string;
    courtName: string;
  }[] = [];

  const [todayY, todayM, todayD] = localDateString().split("-").map(Number);
  for (const rule of rules) {
    if (!rule.court || rule.court.status !== "active") continue;
    for (let i = 0; i < 28; i++) {
      const d = new Date(Date.UTC(todayY, todayM - 1, todayD + i));
      const date = localDateString(d);
      if (d.getUTCDay() !== rule.dayOfWeek) continue;
      if (date < rule.startDate) continue;
      if (rule.endDate && date > rule.endDate) continue;

      const exists = await prisma.booking.findFirst({
        where: {
          recurringId: rule.id,
          date,
          status: { notIn: ["cancelled", "released"] },
        },
        select: { id: true },
      });
      if (exists) continue;

      try {
        await createBooking({
          courtId: rule.courtId,
          memberId: rule.memberId,
          date,
          startTime: rule.startTime,
          durationMinutes: rule.durationMinutes,
          source: "recurring",
          confirmed: true,
          recurringId: rule.id,
          note: rule.note ?? "固定訂位",
        });
        created++;
      } catch (e) {
        // 時段被佔（其他訂位先佔了）→ 不再靜默：回報 + LINE 通知(去重)
        if (isUniqueViolation(e)) {
          conflicts.push({
            ruleId: rule.id,
            date,
            startTime: rule.startTime,
            endTime: toHHMM(toMinutes(rule.startTime) + rule.durationMinutes),
            dayOfWeek: rule.dayOfWeek,
            memberName: rule.member?.name ?? "會員",
            courtName: rule.court.name,
          });
          await notifyRecurringConflict(rule);
        }
      }
    }
  }

  return { created, conflicts };
}

/** 固定位被佔：LINE 通知老闆（依 skipNotifiedAt 去重，避免每小時重複吵） */
async function notifyRecurringConflict(rule: {
  id: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  member?: { name: string } | null;
  court: { name: string };
  skipNotifiedAt?: Date | null;
}): Promise<void> {
  const last = rule.skipNotifiedAt?.getTime() ?? 0;
  if (Date.now() - last < CONFLICT_NOTIFY_COOLDOWN_MS) return; // 去重
  const day = DOW_NAMES[rule.dayOfWeek];
  const end = toHHMM(toMinutes(rule.startTime) + rule.durationMinutes);
  await sendLineAdminNotify(
    `⚠️ 固定位生成撞到衝突：${rule.member?.name ?? "會員"}｜${rule.court.name} 週${day} ${rule.startTime}-${end}｜該時段已被其他訂位佔用，本次未生成。請到「固定訂位」確認。`,
    "instant"
  );
  await prisma.recurringBooking.update({
    where: { id: rule.id },
    data: { skipNotifiedAt: new Date() },
  });
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2002"
  );
}
