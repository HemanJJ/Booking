import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  togglePriceRuleAction,
  deletePriceRuleAction,
} from "@/app/admin/actions";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "價位規則",
};

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

type RuleItem = {
  id: string;
  name: string;
  price: number;
  kind: string;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  date: string | null;
  active: string;
  venueName: string;
};

function RuleRow({ r }: { r: RuleItem }) {
  const desc =
    r.kind === "date"
      ? `${r.date} 整日`
      : `週${DAYS[r.dayOfWeek ?? 0]} ${r.startTime}–${r.endTime}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="font-semibold">
          {r.name}
          <span className="ml-2 font-normal text-slate-500">
            {formatPrice(r.price)} / 小時
          </span>
          {r.active !== "active" && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              已停用
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {r.venueName} · {desc}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/pricing/${r.id}/edit`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          編輯
        </Link>
        <form action={togglePriceRuleAction}>
          <input type="hidden" name="id" value={r.id} />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {r.active === "active" ? "停用" : "啟用"}
          </button>
        </form>
        <form action={deletePriceRuleAction}>
          <input type="hidden" name="id" value={r.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            刪除
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function AdminPricingPage() {
  const rules = await prisma.priceRule.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { venue: true },
  });

  const items: RuleItem[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    kind: r.kind,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    date: r.date,
    active: r.active,
    venueName: r.venue.name,
  }));

  const dates = items.filter((r) => r.kind === "date");
  const weekly = items.filter((r) => r.kind === "weekly");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">價位規則</h1>
        <Link
          href="/admin/pricing/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ＋ 新增規則
        </Link>
      </div>

      <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        定價優先序：<b>特定日期</b>（國定假日/颱風假，整日）＞{" "}
        <b>固定週規則</b>（尖峰/離峰）＞ 場地時價。以 30 分鐘為計價單位，跨時段自動分段。
      </p>

      <h2 className="mb-3 text-lg font-semibold">特定日期（整日價）</h2>
      {dates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          尚無特定日期規則。颱風假宣布時，來這裡新增一筆日期規則即可。
        </p>
      ) : (
        <div className="space-y-3">
          {dates.map((r) => (
            <RuleRow key={r.id} r={r} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">固定週規則</h2>
      {weekly.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          尚無週規則。
        </p>
      ) : (
        <div className="space-y-3">
          {weekly.map((r) => (
            <RuleRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
