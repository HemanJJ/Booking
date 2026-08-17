import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DurationDiscountForm from "@/components/admin/DurationDiscountForm";

export const metadata: Metadata = {
  title: "編輯時長折扣",
};

export default async function EditDurationDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rule = await prisma.durationDiscount.findUnique({ where: { id } });
  if (!rule) notFound();

  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/admin/discounts" className="hover:text-emerald-700">
          ← 返回時長折扣
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">編輯時長折扣：{rule.name}</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <DurationDiscountForm
          venues={venues}
          rule={{
            id: rule.id,
            venueId: rule.venueId,
            name: rule.name,
            minMinutes: rule.minMinutes,
            fixedAmount: rule.fixedAmount,
            tierPrice: rule.tierPrice,
            active: rule.active,
          }}
        />
      </div>
    </div>
  );
}
