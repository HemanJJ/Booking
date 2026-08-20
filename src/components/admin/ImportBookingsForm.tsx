"use client";

import { useActionState, useState } from "react";
import { importBookingsAction, type ImportState } from "@/app/admin/actions";

export default function ImportBookingsForm() {
  const [state, action, pending] = useActionState(importBookingsAction, {} as ImportState);
  const [csv, setCsv] = useState("");

  return (
    <div>
      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">貼上 CSV（或用 Excel 複製貼上）</label>
          <p className="mb-2 text-xs text-slate-500">
            欄位：date,startTime,durationMinutes,courtName,memberName,phone,payCash
            （逗號或 Tab 分隔皆可）。範本見 docs/人工接單範本.csv
          </p>
          <textarea
            name="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            placeholder={"date,startTime,durationMinutes,courtName,memberName,phone,payCash\n2026-08-20,20:00,120,1 號場,王小明,0912345678,是"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</p>
        )}

        {state?.imported !== undefined && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-semibold text-emerald-700">
              ✅ 成功匯入 {state.imported} 筆
            </p>
            {state.skipped && state.skipped.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-amber-600">
                  跳過 {state.skipped.length} 筆（時段被佔/欄位錯誤）：
                </p>
                <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-slate-500">
                  {state.skipped.map((s, i) => (
                    <li key={i} className="py-0.5">
                      • {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !csv.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300"
        >
          {pending ? "匯入中…" : "匯入"}
        </button>
      </form>
    </div>
  );
}
