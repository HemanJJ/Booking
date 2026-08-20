import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CourtForm from "@/components/admin/CourtForm";

export const metadata: Metadata = {
  title: "新增場地",
};

export default async function NewCourtPage() {
  await requireRole(["admin"]);
  const venues = await prisma.venue.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/admin/courts" className="hover:text-emerald-700">
          ← 返回場地管理
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">新增場地</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CourtForm venues={venues} />
      </div>
    </div>
  );
}
