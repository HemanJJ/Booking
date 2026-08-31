"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import {
  createBooking,
  updateBooking,
  markBookingPaid,
  markBookingUnpaid,
  generateRecurringBookings,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} from "@/lib/booking";
import { markAttendance } from "@/lib/noshow";
import { sendLineAdminNotify } from "@/lib/notify";
import { formatPrice } from "@/lib/utils";
import { logBookingEvent } from "@/lib/audit";

export type AdminState = { error?: string };

async function requireStaff() {
  const member = await getCurrentMember();
  if (!member) redirect("/account/login?returnTo=%2Fadmin");
  if (member.role !== "admin" && member.role !== "staff") redirect("/");
  return member;
}

async function requireOwner() {
  const member = await getCurrentMember();
  if (!member) redirect("/account/login?returnTo=%2Fadmin");
  if (member.role !== "admin") redirect("/");
  return member;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function toInt(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

// ===== 場館（useActionState 2-arg，供表單元件） =====
export async function saveVenueAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const openingTime = String(formData.get("openingTime") ?? "08:00").trim();
  let closingTime = String(formData.get("closingTime") ?? "24:00").trim();
  if (closingTime === "00:00") closingTime = "24:00"; // 午夜＝24:00（內部表示）
  const status = String(formData.get("status") ?? "active");

  if (!name) return { error: "請填寫場館名稱" };
  if (!TIME_RE.test(openingTime) && openingTime !== "24:00") {
    return { error: "開始時間格式應為 HH:MM" };
  }
  if (!TIME_RE.test(closingTime) && closingTime !== "24:00") {
    return { error: "結束時間格式應為 HH:MM（24 小時營業請填 24:00）" };
  }

  const data = {
    name,
    location: location || null,
    phone: phone || null,
    openingTime,
    closingTime,
    status,
  };

  if (id) await prisma.venue.update({ where: { id }, data });
  else await prisma.venue.create({ data });

  revalidatePath("/admin/venues");
  redirect("/admin/venues");
}

export async function saveCourtAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const pricePerHour = toInt(String(formData.get("pricePerHour") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const featured = formData.get("featured") === "on";
  const status = String(formData.get("status") ?? "active");

  if (!venueId) return { error: "請選擇場館" };
  if (!name) return { error: "請填寫場地名稱（例如：1 號場）" };
  if (pricePerHour === null || pricePerHour < 0) {
    return { error: "請填寫正確的時價（每小時）" };
  }

  const data = {
    venueId,
    name,
    pricePerHour,
    description: description || null,
    featured,
    status,
  };

  if (id) await prisma.court.update({ where: { id }, data });
  else await prisma.court.create({ data });

  revalidatePath("/admin/courts");
  redirect("/admin/courts");
}

// ===== 狀態切換 / 取消 / 角色（單一 formData 參數，供 <form action>） =====
export async function toggleVenueStatusAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (venue) {
    await prisma.venue.update({
      where: { id },
      data: { status: venue.status === "active" ? "inactive" : "active" },
    });
  }
  revalidatePath("/admin/venues");
}

export async function toggleCourtStatusAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const court = await prisma.court.findUnique({ where: { id } });
  if (court) {
    await prisma.court.update({
      where: { id },
      data: { status: court.status === "active" ? "inactive" : "active" },
    });
  }
  revalidatePath("/admin/courts");
}

export async function adminCancelBookingAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { court: { include: { venue: true } }, member: true },
  });
  if (booking && booking.status !== "cancelled" && booking.status !== "released") {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: "cancelled" },
      });
      await tx.bookingSlot.deleteMany({ where: { bookingId: id } });
    });
    await logBookingEvent({
      bookingId: id,
      actorName: "管理員",
      action: "cancel",
      detail: `取消訂位｜${booking.member.name}｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}`,
    });
    await sendLineAdminNotify(
      `🔴 後台取消訂位｜${booking.member.name}｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}`,
      "instant"
    );
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
}

export async function toggleMemberRoleAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return; // 不允許對自己降權
  const member = await prisma.member.findUnique({ where: { id } });
  if (member) {
    await prisma.member.update({
      where: { id },
      data: { role: member.role === "admin" ? "member" : "admin" },
    });
  }
  revalidatePath("/admin/members");
}

export async function toggleStaffAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return; // 不允許對自己降權
  const member = await prisma.member.findUnique({ where: { id } });
  if (member) {
    await prisma.member.update({
      where: { id },
      data: { role: member.role === "staff" ? "member" : "staff" },
    });
  }
  revalidatePath("/admin/members");
}

// ===== 會員：新增（後台人工登打） =====
export async function createMemberAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!name) return { error: "請填寫會員姓名" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email 格式錯誤" };
  if (email) {
    const dup = await prisma.member.findUnique({ where: { email } });
    if (dup) return { error: `該 Email 已是會員：${dup.name}` };
  }
  if (phone) {
    const dup = await prisma.member.findFirst({ where: { phone } });
    if (dup) return { error: `該手機已是會員：${dup.name}` };
  }

  await prisma.member.create({
    data: { name, email, phone, role: "member" },
  });
  revalidatePath("/admin/members");
  return {};
}

// ===== 價位規則（尖峰/離峰週規則 + 特定日期） =====
export async function savePriceRuleAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const price = toInt(String(formData.get("price") ?? ""));
  const kind = String(formData.get("kind") ?? "weekly");
  const active = String(formData.get("active") ?? "active");

  if (!venueId) return { error: "請選擇場館" };
  if (!name) return { error: "請填寫規則名稱（如：尖峰 / 離峰 / 國慶日）" };
  if (price === null || price < 0) return { error: "請填寫正確的每小時價格" };

  const base = { venueId, name, price, kind, active };

  if (kind === "date") {
    const date = String(formData.get("date") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "請填寫日期（YYYY-MM-DD）" };
    }
    if (id) {
      await prisma.priceRule.update({
        where: { id },
        data: { ...base, date, dayOfWeek: null, startTime: null, endTime: null },
      });
    } else {
      await prisma.priceRule.create({ data: { ...base, date } });
    }
  } else {
    const dayOfWeek = toInt(String(formData.get("dayOfWeek") ?? ""));
    const startTime = String(formData.get("startTime") ?? "").trim();
    const endTime = String(formData.get("endTime") ?? "").trim();
    if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
      return { error: "請選擇星期（0=日 ~ 6=六）" };
    }
    if (!TIME_RE.test(startTime) && startTime !== "24:00") {
      return { error: "開始時間格式應為 HH:MM" };
    }
    if (!TIME_RE.test(endTime) && endTime !== "24:00") {
      return { error: "結束時間格式應為 HH:MM（可填 24:00）" };
    }
    if (id) {
      await prisma.priceRule.update({
        where: { id },
        data: { ...base, dayOfWeek, startTime, endTime, date: null },
      });
    } else {
      await prisma.priceRule.create({
        data: { ...base, dayOfWeek, startTime, endTime },
      });
    }
  }

  revalidatePath("/admin/pricing");
  redirect("/admin/pricing");
}

export async function togglePriceRuleAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const rule = await prisma.priceRule.findUnique({ where: { id } });
  if (rule) {
    await prisma.priceRule.update({
      where: { id },
      data: { active: rule.active === "active" ? "inactive" : "active" },
    });
  }
  revalidatePath("/admin/pricing");
}

export async function deletePriceRuleAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  await prisma.priceRule.deleteMany({ where: { id } });
  revalidatePath("/admin/pricing");
}

// ===== 時長折扣（滿 N 分鐘折 X 元） =====
export async function saveDurationDiscountAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const minMinutes = toInt(String(formData.get("minMinutes") ?? ""));
  const fixedAmount = toInt(String(formData.get("fixedAmount") ?? ""));
  const tierPriceRaw = String(formData.get("tierPrice") ?? "").trim();
  const tierPrice = tierPriceRaw === "" ? null : toInt(tierPriceRaw);
  const active = String(formData.get("active") ?? "active");

  if (!venueId) return { error: "請選擇場館" };
  if (!name) return { error: "請填寫規則名稱（如：滿 2 小時折 100）" };
  if (minMinutes === null || minMinutes <= 0) {
    return { error: "請填寫門檻時長（分鐘，2 小時 = 120）" };
  }
  if (fixedAmount === null || fixedAmount <= 0) {
    return { error: "請填寫折抵金額" };
  }
  if (tierPriceRaw !== "" && tierPrice === null) {
    return { error: "「僅限時價」格式錯誤，留空表示所有時段" };
  }

  const data = { venueId, name, minMinutes, fixedAmount, tierPrice, active };
  if (id) await prisma.durationDiscount.update({ where: { id }, data });
  else await prisma.durationDiscount.create({ data });

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function toggleDurationDiscountAction(
  formData: FormData
): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const rule = await prisma.durationDiscount.findUnique({ where: { id } });
  if (rule) {
    await prisma.durationDiscount.update({
      where: { id },
      data: { active: rule.active === "active" ? "inactive" : "active" },
    });
  }
  revalidatePath("/admin/discounts");
}

export async function deleteDurationDiscountAction(
  formData: FormData
): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  await prisma.durationDiscount.deleteMany({ where: { id } });
  revalidatePath("/admin/discounts");
}

// ===== 代客下單 / 改單 / 收款標記 / 會員停權（老闆視角，PRD 14） =====

/** 解析會員：選既有會員 → 用其 id；否則用「臨時客人」姓名＋電話（電話相符就沿用，避免重複建檔） */
async function resolveMemberId(formData: FormData): Promise<string> {
  const memberId = String(formData.get("memberId") ?? "").trim();
  if (memberId) {
    const picked = await prisma.member.findUnique({
      where: { id: memberId },
      select: { banned: true },
    });
    if (picked?.banned) throw new Error("該會員已停權，無法代客下單");
    return memberId;
  }
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) throw new Error("請選擇會員或輸入臨時客人姓名");
  if (phone) {
    const existing = await prisma.member.findFirst({ where: { phone } });
    if (existing) {
      if (existing.banned) throw new Error("該會員已停權，無法代客下單");
      return existing.id;
    }
  }
  const created = await prisma.member.create({
    data: { name, phone: phone || null },
  });
  return created.id;
}

export async function adminCreateBookingAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireStaff();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);
  const payNow = String(formData.get("payNow") ?? "cash");
  const note = String(formData.get("note") ?? "").trim();
  // source：phone=電話訂位（平板櫃台）｜admin=現場代客｜member=會員自助
  const src = String(formData.get("source") ?? "admin").trim();
  const source = src === "phone" ? "phone" : "admin";

  try {
    const memberId = await resolveMemberId(formData);
    const booking = await createBooking({
      courtId,
      memberId,
      date,
      startTime,
      durationMinutes,
      source,
      note: note || null,
    });
    if (payNow === "cash") {
      await markBookingPaid(booking.id, "cash");
    }
    const isPhone = source === "phone";
    await logBookingEvent({
      bookingId: booking.id,
      actorName: "管理員",
      action: "create",
      detail: `${isPhone ? "📞 電話訂位" : "代客下單"}｜${booking.venueName} ${booking.courtName}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}${payNow === "cash" ? "｜已收現金" : "｜未收"}`,
    });
    await sendLineAdminNotify(
      `${isPhone ? "📞 電話訂位" : "🟢 代客下單"}｜${booking.venueName} ${booking.courtName}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}${payNow === "cash" ? "（已收現金）" : "（未收）"}`,
      "quiet"
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "建立訂位失敗，請稍後再試" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  // returnTo 可讓排班板/櫃台等處「頁內代客下單」後留在原頁
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  redirect(returnTo && returnTo.startsWith("/") ? returnTo : "/admin");
}

export async function adminUpdateBookingAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireStaff();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);

  const old = await prisma.booking.findUnique({ where: { id: bookingId } });

  try {
    const booking = await updateBooking({
      bookingId,
      courtId,
      date,
      startTime,
      durationMinutes,
    });
    await logBookingEvent({
      bookingId,
      actorName: "管理員",
      action: "update",
      detail: describeChange(old, {
        courtId,
        date,
        startTime,
        durationMinutes,
      }),
    });
    await sendLineAdminNotify(
      `🔵 改單｜${booking.venueName} ${booking.courtName}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}`,
      "instant"
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "改單失敗，請稍後再試" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

/** 產生改單的「舊→新」人讀摘要 */
function describeChange(
  old: {
    courtId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
  } | null,
  next: { courtId: string; date: string; startTime: string; durationMinutes: number }
): string {
  if (!old) return "改單（無舊資料）";
  const parts: string[] = [];
  if (old.courtId !== next.courtId) parts.push("換場地");
  if (old.date !== next.date) parts.push(`日期 ${old.date}→${next.date}`);
  if (old.startTime !== next.startTime)
    parts.push(`開始 ${old.startTime}→${next.startTime}`);
  if (old.durationMinutes !== next.durationMinutes)
    parts.push(`時長 ${old.durationMinutes}→${next.durationMinutes} 分`);
  return parts.length ? parts.join("，") : "無變更";
}

/** 收款標記一鍵切換：未收 ↔ 已收現金 */
export async function toggleCashPaymentAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return;
  if (booking.status === "cancelled" || booking.status === "released") {
    revalidatePath("/admin");
    return;
  }
  if (booking.paymentStatus === "cash") {
    await markBookingUnpaid(id);
    await logBookingEvent({
      bookingId: id,
      actorName: "管理員",
      action: "unpaid",
      detail: "收款標記：已收現金 → 未收",
    });
  } else {
    await markBookingPaid(id, "cash");
    await logBookingEvent({
      bookingId: id,
      actorName: "管理員",
      action: "pay",
      detail: "收款標記：已收現金",
    });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
}

/** 快速加減時長（＋30 分 / −30 分），沿用防重疊與營業時間檢查。
 *  允許調整過去訂位（後台補登情境）；錯誤會 throw 讓前端顯示原因。 */
export async function adminAdjustDurationAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (!delta) return;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { court: { include: { venue: true } } },
  });
  if (!booking) return;
  if (booking.status === "cancelled" || booking.status === "released") {
    throw new Error("已取消或已釋放的訂位無法修改");
  }
  const newDuration = booking.durationMinutes + delta;
  await updateBooking({
    bookingId: id,
    courtId: booking.courtId,
    date: booking.date,
    startTime: booking.startTime,
    durationMinutes: newDuration,
    allowPast: true,
  });
  await logBookingEvent({
    bookingId: id,
    actorName: "管理員",
    action: delta > 0 ? "extend" : "shorten",
    detail: `時長 ${booking.durationMinutes}→${newDuration} 分｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}`,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
}

/** 拖拉調整時長：直接設定為指定時長（30 分單位；排班板右緣把手用） */
export async function adminResizeBookingAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireStaff();
  const bookingId = String(formData.get("bookingId") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { court: { include: { venue: true } } },
  });
  if (!booking) return { ok: false, error: "訂位不存在" };
  if (booking.status === "cancelled" || booking.status === "released") {
    return { ok: false, error: "已取消或已釋放的訂位無法修改" };
  }
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES ||
    durationMinutes % 30 !== 0
  ) {
    return { ok: false, error: "時長須為 30 的倍數（30~240 分）" };
  }
  try {
    await updateBooking({
      bookingId,
      courtId: booking.courtId,
      date: booking.date,
      startTime: booking.startTime,
      durationMinutes,
      allowPast: true,
    });
    await logBookingEvent({
      bookingId,
      actorName: "管理員",
      action: durationMinutes > booking.durationMinutes ? "extend" : "shorten",
      detail: `拖拉調整時長 ${booking.durationMinutes}→${durationMinutes} 分｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}`,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "調整時長失敗（時段可能被佔）",
    };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  return { ok: true };
}

/** 拖移搬訂位：搬時間（同面場）或換面場（同時段），時長不變 */
export async function adminMoveBookingAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireStaff();
  const bookingId = String(formData.get("bookingId") ?? "");
  const courtId = String(formData.get("courtId") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "訂位不存在" };
  if (booking.status === "cancelled" || booking.status === "released") {
    return { ok: false, error: "訂位已取消或已釋放" };
  }

  const old = {
    courtId: booking.courtId,
    date: booking.date,
    startTime: booking.startTime,
    durationMinutes: booking.durationMinutes,
  };

  try {
    const updated = await updateBooking({
      bookingId,
      courtId,
      date,
      startTime,
      durationMinutes: booking.durationMinutes,
    });
    await logBookingEvent({
      bookingId,
      actorName: "管理員",
      action: "move",
      detail: describeChange(old, {
        courtId,
        date,
        startTime,
        durationMinutes: booking.durationMinutes,
      }),
    });
    await sendLineAdminNotify(
      `🔵 搬移訂位｜${updated.venueName} ${updated.courtName}｜${updated.date} ${updated.startTime}-${updated.endTime}`,
      "instant"
    );
    revalidatePath("/admin");
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/bookings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "搬移失敗" };
  }
}

/** 解鎖停權會員（no-show 永久停權後人工解除；解除後未到次數歸零重新計算） */
export async function unlockMemberAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  await prisma.member.update({
    where: { id },
    data: { banned: false, noShowCount: 0 },
  });
  revalidatePath("/admin/members");
}

/** 人工停權會員（不允許對自己停權） */
export async function banMemberAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return;
  await prisma.member.update({ where: { id }, data: { banned: true } });
  revalidatePath("/admin/members");
}

/** 標記訂位到場狀態（已到場 / 未到 / 清除標記） */
export async function markAttendanceAction(formData: FormData): Promise<void> {
  await requireStaff();
  const bookingId = String(formData.get("bookingId") ?? "");
  const attendance = String(formData.get("attendance") ?? "") as
    | "arrived"
    | "noshow"
    | "pending";
  if (!bookingId || !["arrived", "noshow", "pending"].includes(attendance)) {
    throw new Error("參數錯誤");
  }
  await markAttendance(bookingId, attendance, "管理員");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/members");
}

// ===== 固定訂位（每週固定團） =====
export async function saveRecurringBookingAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireStaff();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const dayOfWeek = Number(formData.get("dayOfWeek") ?? -1);
  const startTime = String(formData.get("startTime") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!courtId) return { error: "請選擇場地" };
  if (!memberId) return { error: "請選擇會員" };
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: "請選擇星期" };
  if (!TIME_RE.test(startTime)) return { error: "開始時間格式應為 HH:MM" };
  if (
    durationMinutes < 30 ||
    durationMinutes > 240 ||
    durationMinutes % 30 !== 0
  ) {
    return { error: "時長須為 30 的倍數（30~240 分）" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "起始日期格式錯誤（YYYY-MM-DD）" };
  }
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
    return { error: "終止日期格式錯誤（YYYY-MM-DD）" };
  }

  const rule = await prisma.recurringBooking.create({
    data: {
      courtId,
      memberId,
      dayOfWeek,
      startTime,
      durationMinutes,
      startDate,
      endDate: endDateRaw || null,
      note: note || null,
    },
  });
  const { conflicts } = await generateRecurringBookings();
  revalidatePath("/admin/recurring");
  revalidatePath("/admin");
  const mine = conflicts.filter((c) => c.ruleId === rule.id);
  if (mine.length > 0) {
    const c = mine[0];
    const day = ["日", "一", "二", "三", "四", "五", "六"][c.dayOfWeek];
    return {
      error: `⚠️ 固定位已建立，但撞到衝突：${c.memberName}｜${c.courtName} 週${day} ${c.startTime}-${c.endTime} 該時段已被其他訂位佔用，這筆沒生成。之後時段空出來會自動生成（也請確認那筆佔用訂位）。`,
    };
  }
  redirect("/admin/recurring");
}

export async function updateRecurringBookingAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireStaff();
  const id = String(formData.get("id") ?? "").trim();
  const courtId = String(formData.get("courtId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const dayOfWeek = Number(formData.get("dayOfWeek") ?? -1);
  const startTime = String(formData.get("startTime") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "缺少固定位 id" };
  if (!courtId) return { error: "請選擇場地" };
  if (!memberId) return { error: "請選擇會員" };
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: "請選擇星期" };
  if (!TIME_RE.test(startTime)) return { error: "開始時間格式應為 HH:MM" };
  if (durationMinutes < 30 || durationMinutes > 240 || durationMinutes % 30 !== 0) {
    return { error: "時長須為 30 的倍數（30~240 分）" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "起始日期格式錯誤（YYYY-MM-DD）" };
  }
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
    return { error: "終止日期格式錯誤（YYYY-MM-DD）" };
  }

  const rule = await prisma.recurringBooking.update({
    where: { id },
    data: {
      courtId,
      memberId,
      dayOfWeek,
      startTime,
      durationMinutes,
      startDate,
      endDate: endDateRaw || null,
      note: note || null,
    },
  });

  // 清除此固定位舊生成訂位（含時段），再重新生成，避免舊星期/時段殘留
  await prisma.$transaction(async (tx) => {
    const olds = await tx.booking.findMany({
      where: { recurringId: rule.id },
      select: { id: true },
    });
    const ids = olds.map((b) => b.id);
    if (ids.length) {
      await tx.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.booking.deleteMany({ where: { id: { in: ids } } });
    }
  });

  const { conflicts } = await generateRecurringBookings();
  revalidatePath("/admin/recurring");
  revalidatePath("/admin");
  const mine = conflicts.filter((c) => c.ruleId === rule.id);
  if (mine.length > 0) {
    const c = mine[0];
    const day = ["日", "一", "二", "三", "四", "五", "六"][c.dayOfWeek];
    return {
      error: `⚠️ 已更新，但撞到衝突：${c.memberName}｜${c.courtName} 週${day} ${c.startTime}-${c.endTime} 該時段已被佔，這幾週沒生成（空出來會自動補）。`,
    };
  }
  redirect("/admin/recurring");
}

export async function stopRecurringBookingAction(
  formData: FormData
): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  await prisma.recurringBooking.update({
    where: { id },
    data: { status: "stopped" },
  });
  revalidatePath("/admin/recurring");
}

// ===== 批次匯入（人工接單補登，災難復原用） =====
export type ImportState = {
  error?: string;
  imported?: number;
  skipped?: string[];
};

/** 簡易 CSV 解析（支援逗號或 Tab 分隔、雙引號包覆） */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function findOrCreateMember(name: string, phone: string): Promise<string> {
  if (phone) {
    const byPhone = await prisma.member.findFirst({ where: { phone } });
    if (byPhone) return byPhone.id;
  }
  const byName = await prisma.member.findFirst({ where: { name } });
  if (byName) return byName.id;
  const created = await prisma.member.create({
    data: { name, phone: phone || null },
  });
  return created.id;
}

export async function importBookingsAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireStaff();
  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) return { error: "請貼上 CSV 內容" };

  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: "至少要有標題列＋一筆資料" };

  const sep = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim());
  const idx = (k: string) => headers.indexOf(k);

  let imported = 0;
  const skipped: string[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep);
    const get = (k: string) => (idx(k) >= 0 ? cells[idx(k)] ?? "" : "");
    const date = get("date");
    const startTime = get("startTime");
    const durationMinutes = Number(get("durationMinutes"));
    const courtName = get("courtName");
    const memberName = get("memberName");
    const phone = get("phone");
    const payCash = ["是", "y", "yes", "1", "true"].includes(
      get("payCash").toLowerCase()
    );
    const tag = `${date} ${startTime} ${courtName || "?"}`;

    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
        throw new Error("日期/時間格式錯誤");
      }
      if (!memberName) throw new Error("缺姓名");
      const court = await prisma.court.findFirst({
        where: { name: courtName, status: "active" },
      });
      if (!court) throw new Error("找不到場地");
      const memberId = await findOrCreateMember(memberName, phone);

      const booking = await createBooking({
        courtId: court.id,
        memberId,
        date,
        startTime,
        durationMinutes,
        source: "admin",
        confirmed: true, // 補登視為已確認（不走 24h 保留）
        allowPast: true, // 允許補登過去時段
        note: "人工接單補登",
      });
      if (payCash) await markBookingPaid(booking.id, "cash");
      imported++;
    } catch (e) {
      skipped.push(
        `${tag}：${e instanceof Error ? e.message : "失敗"}`
      );
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  return { imported, skipped };
}
