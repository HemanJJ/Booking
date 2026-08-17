import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CourtForm from "@/components/admin/CourtForm";

export const metadata: Metadata = {
  title: "編輯場地",
};

export default async function EditCourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const court = await prisma.court.findUnique({
    where: { id },
    include: { venue: true },
  });
  if (!court) notFound();

  const venues = await prisma.venue.findMany({
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
      <h1 className="mb-6 text-2xl font-bold">
        編輯場地：{court.venue.name} · {court.name}
      </h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CourtForm
          venues={venues}
          court={{
            id: court.id,
            venueId: court.venueId,
            name: court.name,
            pricePerHour: court.pricePerHour,
            description: court.description,
            status: court.status,
          }}
        />
      </div>
    </div>
  );
}
