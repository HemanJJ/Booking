import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PriceRuleForm from "@/components/admin/PriceRuleForm";

export const metadata: Metadata = {
  title: "新增價位規則",
};

export default async function NewPriceRulePage() {
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/admin/pricing" className="hover:text-emerald-700">
          ← 返回價位規則
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">新增價位規則</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PriceRuleForm venues={venues} />
      </div>
    </div>
  );
}
