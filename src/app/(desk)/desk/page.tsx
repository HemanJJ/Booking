import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { localDateString } from "@/lib/utils";
import { getCurrentMember } from "@/lib/auth";
import DeskBoard from "@/components/admin/DeskBoard";

export const metadata: Metadata = {
  title: "櫃台模式",
};

/** 平板櫃台模式：電話訂位總表＋收款＋明細（櫃員/第一線高頻操作） */
export default async function AdminDeskPage() {
  const today = localDateString(new Date());
  const member = await getCurrentMember();

  const [courts, bookings, members] = await Promise.all([
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
    prisma.booking.findMany({
      where: {
        date: today,
        status: { notIn: ["cancelled", "released"] },
      },
      orderBy: [{ startTime: "asc" }, { court: { name: "asc" } }],
      include: { court: { include: { venue: true } }, member: true },
    }),
    prisma.member.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  // 今日統計
  const totalBookings = bookings.length;
  const paid = bookings.filter(
    (b) => b.paymentStatus === "cash" || b.paymentStatus === "linepay"
  );
  const revenue = paid.reduce((s, b) => s + b.totalPrice, 0);
  const unpaidCount = bookings.filter(
    (b) => b.paymentStatus === "unpaid" || b.paymentStatus === "points"
  ).length;

  return (
    <DeskBoard
      courts={courts.map((c) => ({
        id: c.id,
        name: c.name,
        venueName: c.venue.name,
        openingTime: c.venue.openingTime,
        closingTime: c.venue.closingTime,
      }))}
      bookings={bookings.map((b) => ({
        id: b.id,
        courtId: b.courtId,
        courtName: b.court.name,
        venueName: b.court.venue.name,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        totalPrice: b.totalPrice,
        memberName: b.member.name,
        status: b.status,
        paymentStatus: b.paymentStatus,
      }))}
      members={members}
      stats={{ totalBookings, revenue, unpaidCount }}
      today={today}
      role={member?.role ?? "member"}
    />
  );
}
