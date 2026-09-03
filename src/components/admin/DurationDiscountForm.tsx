"use client";

import { useActionState } from "react";
import { saveDurationDiscountAction } from "@/app/admin/actions";
import Spinner from "@/components/Spinner";

export type DurationDiscountInput = {
  id?: string;
  venueId?: string;
  name?: string;
  minMinutes?: number;
  fixedAmount?: number;
  tierPrice?: number | null;
  active?: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function DurationDiscountForm({
  rule,
  venues,
}: {
  rule?: DurationDiscountInput;
  venues: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveDurationDiscountAction, {});

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
          placeholder="滿 2 小時折 100"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-semibold">
            門檻時長（分鐘）
          </label>
          <input
            name="minMinutes"
            type="number"
            min={30}
            step={30}
            required
            defaultValue={rule?.minMinutes ?? 120}
            placeholder="120"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">
            固定折抵金額（NT$）
          </label>
          <input
            name="fixedAmount"
            type="number"
            min={0}
            required
            defaultValue={rule?.fixedAmount ?? 100}
            placeholder="100"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">
          僅限時價（留空＝所有時段）
        </label>
        <input
          name="tierPrice"
          type="number"
          min={0}
          defaultValue={rule?.tierPrice ?? ""}
          placeholder="例：400（僅尖峰 400 的時段）"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-slate-400">
          填 400 表示只有「每小時 400 元」的時段算入門檻；留空則尖峰/離峰都算。
        </p>
      </div>

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
        {pending ? "儲存中…" : rule?.id ? "儲存變更" : "新增折扣"}
      </button>
    </form>
  );
}
