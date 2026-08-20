"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  getCurrentMember,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { createBooking, cancelBooking } from "@/lib/booking";
import { sendLineAdminNotify } from "@/lib/notify";
import { formatPrice } from "@/lib/utils";
import { logBookingEvent } from "@/lib/audit";

export type FormState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeReturnTo(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/bookings";
}

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password) {
    return { error: "請填寫姓名、Email 與密碼" };
  }
  if (!EMAIL_RE.test(email)) return { error: "Email 格式不正確" };
  if (password.length < 6) return { error: "密碼至少 6 個字元" };
  if (password !== confirm) return { error: "兩次輸入的密碼不一致" };

  const exists = await prisma.member.findUnique({ where: { email } });
  if (exists) return { error: "此 Email 已被註冊" };

  const passwordHash = await hashPassword(password);
  const member = await prisma.member.create({
    data: { name, email, phone: phone || null, passwordHash },
  });
  await createSession(member.id);
  redirect("/bookings");
}

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo") as string | null);

  if (!email || !password) return { error: "請輸入 Email 與密碼" };

  const member = await prisma.member.findUnique({ where: { email } });
  if (!member || !member.passwordHash) {
    return { error: "帳號或密碼錯誤" };
  }
  const ok = await verifyPassword(password, member.passwordHash);
  if (!ok) return { error: "帳號或密碼錯誤" };

  await createSession(member.id);
  redirect(returnTo);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function createBookingAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) return { error: "請先登入後再預約" };

  const fullMember = await prisma.member.findUnique({
    where: { id: member.id },
    select: { banned: true },
  });
  if (fullMember?.banned) {
    return { error: "您的帳號已停權，請洽場館人員處理" };
  }

  const courtId = String(formData.get("courtId") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);

  let booking: Awaited<ReturnType<typeof createBooking>>;
  try {
    booking = await createBooking({
      courtId,
      memberId: member.id,
      date,
      startTime,
      durationMinutes,
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "訂位失敗，請稍後再試",
    };
  }

  await logBookingEvent({
    bookingId: booking.id,
    actorName: member.name,
    action: "create",
    detail: `會員下單｜${booking.venueName} ${booking.courtName}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}`,
  });
  await sendLineAdminNotify(
    `🟢 新訂位｜${member.name}｜${booking.venueName} ${booking.courtName}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}`,
    "quiet"
  );

  redirect(`/bookings/success?id=${booking.id}`);
}

export async function cancelBookingAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) return { error: "請先登入" };

  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const cancelled = await cancelBooking(bookingId, member.id);
    await logBookingEvent({
      bookingId,
      actorName: member.name,
      action: "cancel",
      detail: `會員取消｜${cancelled.venueName} ${cancelled.courtName}｜${cancelled.date} ${cancelled.startTime}-${cancelled.endTime}`,
    });
    await sendLineAdminNotify(
      `🔴 取消訂位｜${member.name}｜${cancelled.venueName} ${cancelled.courtName}｜${cancelled.date} ${cancelled.startTime}-${cancelled.endTime}`,
      "instant"
    );
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "取消失敗，請稍後再試",
    };
  }
  revalidatePath("/bookings");
  return { ok: true };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) return { error: "請先登入" };

  const full = await prisma.member.findUnique({ where: { id: member.id } });
  const current = String(formData.get("currentPassword") ?? "");
  const newPw = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (newPw.length < 6) return { error: "新密碼至少 6 個字元" };
  if (newPw !== confirm) return { error: "兩次輸入的新密碼不一致" };

  // 原本有密碼才需驗證目前密碼（LINE 首次設密碼則不用）
  if (full?.passwordHash) {
    const ok = await verifyPassword(current, full.passwordHash);
    if (!ok) return { error: "目前密碼錯誤" };
  }

  const passwordHash = await hashPassword(newPw);
  await prisma.member.update({
    where: { id: member.id },
    data: { passwordHash },
  });

  return { ok: true };
}
