"use client";

import { useActionState, useState } from "react";
import { savePriceRuleAction } from "@/app/admin/actions";
import Spinner from "@/components/Spinner";

export type PriceRuleInput = {
  id?: string;
  venueId?: string;
  name?: string;
  price?: number;
  kind?: "weekly" | "date";
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  date?: string | null;
  active?: string;
};

const DAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function PriceRuleForm({
  rule,
  venues,
}: {
  rule?: PriceRuleInput;
  venues: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(savePriceRuleAction, {});
  const [kind, setKind] = useState<"weekly" | "date">(rule?.kind ?? "weekly");

  return (
    <form action={action} className="space-y-4">
      {rule?.id && <input type="hidden" name="id" value={rule.id} />}

      <div>
        <label className="mb-1 block text-sm font-semibold">所屬場館</label>
        <select
          name="venueId"
          defaultValue={rule?.venueId ?? venues[0]?.id ?? ""}
          required
          className={inputCls}
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">規則名稱</label>
        <input
          name="name"
          required
          defaultValue={rule?.name ?? ""}
          placeholder="尖峰 / 離峰 / 國慶日 / 颱風假…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">
          每小時價格（NT$）
        </label>
        <input
          name="price"
          type="number"
          min={0}
          required
          defaultValue={rule?.price ?? 400}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">規則類型</label>
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "weekly" | "date")}
          className={inputCls}
        >
          <option value="weekly">固定週規則（每週幾＋時段）</option>
          <option value="date">特定日期（整日，如國定假日/颱風假）</option>
        </select>
      </div>

      {kind === "weekly" ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">星期</label>
            <select
              name="dayOfWeek"
              defaultValue={rule?.dayOfWeek ?? 1}
              className={inputCls}
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">開始時間</label>
            <input
              name="startTime"
              defaultValue={rule?.startTime ?? "18:00"}
              placeholder="18:00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">結束時間</label>
            <input
              name="endTime"
              defaultValue={rule?.endTime ?? "24:00"}
              placeholder="24:00"
              className={inputCls}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-semibold">日期</label>
          <input
            name="date"
            type="date"
            defaultValue={rule?.date ?? ""}
            className={inputCls}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold">狀態</label>
        <select
          name="active"
          defaultValue={rule?.active ?? "active"}
          className={inputCls}
        >
          <option value="active">啟用</option>
          <option value="inactive">停用</option>
        </select>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending && <Spinner />}
        {pending ? "儲存中…" : rule?.id ? "儲存變更" : "新增規則"}
      </button>
    </form>
  );
}
