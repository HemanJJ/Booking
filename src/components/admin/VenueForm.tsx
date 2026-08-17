"use client";

import { useActionState } from "react";
import { saveVenueAction } from "@/app/admin/actions";

export type VenueInput = {
  id?: string;
  name?: string;
  location?: string | null;
  phone?: string | null;
  openingTime?: string;
  closingTime?: string;
  status?: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function VenueForm({ venue }: { venue?: VenueInput }) {
  const [state, action, pending] = useActionState(saveVenueAction, {});

  return (
    <form action={action} className="space-y-4">
      {venue?.id && <input type="hidden" name="id" value={venue.id} />}

      <div>
        <label className="mb-1 block text-sm font-semibold">場館名稱</label>
        <input
          name="name"
          required
          defaultValue={venue?.name ?? ""}
          placeholder="例如：迪飛太平"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">地址</label>
        <input
          name="location"
          defaultValue={venue?.location ?? ""}
          placeholder="例如：台中市太平區…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">電話</label>
        <input
          name="phone"
          defaultValue={venue?.phone ?? ""}
          placeholder="例如：04-XXXX-XXXX"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">開始時間</label>
          <input
            name="openingTime"
            defaultValue={venue?.openingTime ?? "00:00"}
            placeholder="00:00"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">結束時間</label>
          <input
            name="closingTime"
            defaultValue={venue?.closingTime ?? "24:00"}
            placeholder="24:00（24 小時營業）"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">狀態</label>
        <select
          name="status"
          defaultValue={venue?.status ?? "active"}
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
        {pending ? "儲存中…" : venue?.id ? "儲存變更" : "新增場館"}
      </button>
    </form>
  );
}
