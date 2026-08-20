import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  toggleDurationDiscountAction,
  deleteDurationDiscountAction,
} from "@/app/admin/actions";
import { formatPrice, formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "時長折扣",
};

export default async function AdminDiscountsPage() {
  await requireRole(["admin"]);
  const discounts = await prisma.durationDiscount.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { venue: true },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">時長折扣</h1>
        <Link
          href="/admin/discounts/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 新增折扣
        </Link>
      </div>

      <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        結算順序：時段價（尖峰/離峰）→ 套時長折扣。例：尖峰 2 小時 800 − 滿 2
        小時折 100 ＝ <b>700</b>。
      </p>

      {discounts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          尚無時長折扣。
        </p>
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold">
                  {d.name}
                  {d.active !== "active" && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      已停用
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {d.venue.name} · 滿 {formatDuration(d.minMinutes)} 折{" "}
                  {formatPrice(d.fixedAmount)}
                  {d.tierPrice != null
                    ? `（僅限 ${formatPrice(d.tierPrice)}/小時 的時段）`
                    : "（所有時段）"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/discounts/${d.id}/edit`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  編輯
                </Link>
                <form action={toggleDurationDiscountAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {d.active === "active" ? "停用" : "啟用"}
                  </button>
                </form>
                <form action={deleteDurationDiscountAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    刪除
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
