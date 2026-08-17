import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VenueForm from "@/components/admin/VenueForm";

export const metadata: Metadata = {
  title: "編輯場館",
};

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) notFound();

  return (
    <div className="max-w-xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/admin/venues" className="hover:text-emerald-700">
          ← 返回場館管理
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">編輯場館：{venue.name}</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <VenueForm
          venue={{
            id: venue.id,
            name: venue.name,
            location: venue.location,
            phone: venue.phone,
            openingTime: venue.openingTime,
            closingTime: venue.closingTime,
            status: venue.status,
          }}
        />
      </div>
    </div>
  );
}
