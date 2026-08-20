import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleVenueStatusAction } from "@/app/admin/actions";
import { formatHours } from "@/lib/utils";

export const metadata: Metadata = {
  title: "場館管理",
};

export default async function AdminVenuesPage() {
  await requireRole(["admin"]);
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "asc" },
    include: { courts: { select: { id: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">場館管理</h1>
        <Link
          href="/admin/venues/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 新增場館
        </Link>
      </div>

      {venues.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無場館。
        </p>
      ) : (
        <div className="space-y-3">
          {venues.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <p className="font-semibold">
                  {v.name}
                  {v.status !== "active" && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      已停用
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  📍 {v.location ?? "未填地址"} · {formatHours(v.openingTime, v.closingTime)} ·{" "}
                  {v.courts.length} 面場
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/venues/${v.id}/edit`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  編輯
                </Link>
                <form action={toggleVenueStatusAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {v.status === "active" ? "停用" : "啟用"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
