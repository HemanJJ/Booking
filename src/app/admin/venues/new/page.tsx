import type { Metadata } from "next";
import Link from "next/link";
import VenueForm from "@/components/admin/VenueForm";

export const metadata: Metadata = {
  title: "新增場館",
};

export default function NewVenuePage() {
  return (
    <div className="max-w-xl">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/admin/venues" className="hover:text-emerald-700">
          ← 返回場館管理
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">新增場館</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <VenueForm />
      </div>
    </div>
  );
}
