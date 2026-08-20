import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmLinePayPayment } from "@/lib/linepay";
import { markBookingPaid } from "@/lib/booking";
import { sendLineAdminNotify } from "@/lib/notify";
import { formatPrice } from "@/lib/utils";
import { logBookingEvent } from "@/lib/audit";

/** LINE Pay 付款完成後的回跳確認（confirmUrl） */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId") ?? "";
  const transactionId = url.searchParams.get("transactionId") ?? "";

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { court: { include: { venue: true } }, member: true },
  });

  if (!booking || !transactionId) {
    return NextResponse.redirect(new URL("/bookings?pay=error", url.origin));
  }

  const ok = await confirmLinePayPayment(transactionId, booking.totalPrice);
  if (ok) {
    if (booking.status !== "confirmed") {
      await markBookingPaid(bookingId, "linepay");
      await logBookingEvent({
        bookingId,
        actorName: booking.member.name,
        action: "linepay",
        detail: `LINE Pay 付款成功｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}`,
      });
      await sendLineAdminNotify(
        `🟢 LINE Pay 付款成功｜${booking.member.name}｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}｜${formatPrice(booking.totalPrice)}`,
        "instant"
      );
    }
    return NextResponse.redirect(
      new URL(`/bookings/success?id=${bookingId}&paid=linepay`, url.origin)
    );
  }
  return NextResponse.redirect(new URL("/bookings?pay=failed", url.origin));
}
