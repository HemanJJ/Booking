import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminCreateBookingForm from "@/components/admin/AdminCreateBookingForm";

export const metadata: Metadata = {
  title: "代客下單",
};

export default async function AdminNewBookingPage() {
  const [courts, members] = await Promise.all([
    prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      include: { venue: true },
    }),
    prisma.member.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  if (courts.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">代客下單</h1>
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無啟用的場地，請先新增場館與場地。
        </p>
        <Link
          href="/admin/courts/new"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 新增場地
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">＋ 代客下單</h1>
        <Link
          href="/admin/bookings"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← 回訂位管理
        </Link>
      </div>

      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AdminCreateBookingForm
          courts={courts.map((c) => ({
            id: c.id,
            name: c.name,
            venueName: c.venue.name,
            pricePerHour: c.pricePerHour,
          }))}
          members={members}
        />
      </div>
    </div>
  );
}
