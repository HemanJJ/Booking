"use client";

import { useActionState } from "react";
import { saveCourtAction } from "@/app/admin/actions";

export type CourtInput = {
  id?: string;
  venueId?: string;
  name?: string;
  pricePerHour?: number;
  description?: string | null;
  status?: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function CourtForm({
  court,
  venues,
}: {
  court?: CourtInput;
  venues: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveCourtAction, {});

  return (
    <form action={action} className="space-y-4">
      {court?.id && <input type="hidden" name="id" value={court.id} />}

      <div>
        <label className="mb-1 block text-sm font-semibold">所屬場館</label>
        <select
          name="venueId"
          defaultValue={court?.venueId ?? venues[0]?.id ?? ""}
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
        <label className="mb-1 block text-sm font-semibold">場地名稱</label>
        <input
          name="name"
          required
          defaultValue={court?.name ?? ""}
          placeholder="例如：1 號場"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">時價（NT$ / 小時）</label>
        <input
          name="pricePerHour"
          type="number"
          min={0}
          required
          defaultValue={court?.pricePerHour ?? 400}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">簡介</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={court?.description ?? ""}
          placeholder="場地簡介…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">狀態</label>
        <select
          name="status"
          defaultValue={court?.status ?? "active"}
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
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "儲存中…" : court?.id ? "儲存變更" : "新增場地"}
      </button>
    </form>
  );
}
