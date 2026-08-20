import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import {
  requestLinePayPayment,
  linePayConfirmUrl,
  linePayCancelUrl,
} from "@/lib/linepay";

/** 會員對「保留中」訂位發起 LINE Pay 付款 */
export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let body: { bookingId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
  }
  const bookingId = String(body.bookingId ?? "");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, memberId: member.id },
    include: { court: { include: { venue: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "訂位不存在" }, { status: 404 });
  }
  if (booking.status === "cancelled" || booking.status === "released") {
    return NextResponse.json({ error: "訂位已取消或已釋放" }, { status: 400 });
  }
  if (booking.status === "confirmed") {
    return NextResponse.json({ error: "此訂位已確認付款" }, { status: 400 });
  }

  try {
    const { paymentUrl } = await requestLinePayPayment({
      orderId: booking.id,
      amount: booking.totalPrice,
      productName: `${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}`,
      confirmUrl: linePayConfirmUrl(booking.id),
      cancelUrl: linePayCancelUrl(),
    });
    return NextResponse.json({ paymentUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "付款請求失敗" },
      { status: 400 }
    );
  }
}
