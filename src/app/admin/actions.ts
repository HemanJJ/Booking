"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export type AdminState = { error?: string };

async function requireAdmin() {
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const openingTime = String(formData.get("openingTime") ?? "00:00").trim();
  const closingTime = String(formData.get("closingTime") ?? "24:00").trim();
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const pricePerHour = toInt(String(formData.get("pricePerHour") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
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
    status,
  };

  if (id) await prisma.court.update({ where: { id }, data });
  else await prisma.court.create({ data });

  revalidatePath("/admin/courts");
  redirect("/admin/courts");
}

// ===== 狀態切換 / 取消 / 角色（單一 formData 參數，供 <form action>） =====
export async function toggleVenueStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (booking && booking.status !== "cancelled") {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: "cancelled" },
      });
      await tx.bookingSlot.deleteMany({ where: { bookingId: id } });
    });
  }
  revalidatePath("/admin/bookings");
}

export async function toggleMemberRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
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

// ===== 價位規則（尖峰/離峰週規則 + 特定日期） =====
export async function savePriceRuleAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.priceRule.deleteMany({ where: { id } });
  revalidatePath("/admin/pricing");
}

// ===== 時長折扣（滿 N 分鐘折 X 元） =====
export async function saveDurationDiscountAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.durationDiscount.deleteMany({ where: { id } });
  revalidatePath("/admin/discounts");
}
