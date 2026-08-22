import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ScheduleBoard from "@/components/admin/ScheduleBoard";

export const metadata: Metadata = {
  title: "排班拖移",
};

export default async function AdminSchedulePage() {
  const [courts, members] = await Promise.all([
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
    prisma.member.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  if (courts.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">排班拖移</h1>
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無啟用的場地。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">排班拖移</h1>
          <p className="mt-1 text-sm text-slate-500">
            抓色塊左右拖＝改時間；上下拖＝換面場；拖右緣＝調時長；點一下＝快速編輯；點空白時段＝代客下單。
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 代客下單
        </Link>
      </div>

      <ScheduleBoard
        courts={courts.map((c) => ({
          id: c.id,
          name: c.name,
          venueName: c.venue.name,
          openingTime: c.venue.openingTime,
          closingTime: c.venue.closingTime,
        }))}
        members={members}
      />
    </div>
  );
}
