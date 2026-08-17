import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import WeekSchedule from "@/components/WeekSchedule";

export const metadata: Metadata = {
  title: "查閱場地",
};

export default async function SchedulePage() {
  const courts = await prisma.court.findMany({
    where: { status: "active", venue: { status: "active" } },
    orderBy: { name: "asc" },
    include: { venue: true },
  });

  const data = courts.map((c) => ({
    id: c.id,
    name: c.name,
    venueName: c.venue.name,
  }));
  const venueName = data[0]?.venueName ?? "場地";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">查閱場地</h1>
        <p className="mt-2 text-slate-600">
          {venueName} — 未來 7 日各場地預約狀況。紅色＝已預約、空白＝可預約，
          點場地名稱即可前往預約。
        </p>
      </div>

      <WeekSchedule courts={data} mode="public" />

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        想直接預約？到{" "}
        <Link href="/courts" className="font-semibold text-emerald-700 hover:underline">
          場館預約
        </Link>{" "}
        挑選場地，或點上方週表的場地名稱。
      </div>
    </div>
  );
}
