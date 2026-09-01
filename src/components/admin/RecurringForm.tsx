"use client";

import { useActionState } from "react";
import {
  saveRecurringBookingAction,
  updateRecurringBookingAction,
  type AdminState,
} from "@/app/admin/actions";
import { localDateString } from "@/lib/utils";
import Spinner from "@/components/Spinner";

export type RecCourtOption = { id: string; name: string; venueName: string };
export type RecMemberOption = { id: string; name: string; phone: string | null };

export type RecEditable = {
  id: string;
  memberId: string;
  courtId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  startDate: string;
  endDate: string | null;
  note: string | null;
};

const DOW = [
  ["1", "週一"],
  ["2", "週二"],
  ["3", "週三"],
  ["4", "週四"],
  ["5", "週五"],
  ["6", "週六"],
  ["0", "週日"],
];
const DUR = [30, 60, 90, 120, 150, 180, 210, 240];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
const TIMES: string[] = [];
for (let t = 8 * 60; t < 24 * 60; t += 30) {
  TIMES.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
}

export default function RecurringForm({
  courts,
  members,
  recurring,
  onCloseEdit,
}: {
  courts: RecCourtOption[];
  members: RecMemberOption[];
  recurring?: RecEditable | null;
  onCloseEdit?: () => void;
}) {
  const edit = !!recurring;
  const [state, action, pending] = useActionState(
    edit ? updateRecurringBookingAction : saveRecurringBookingAction,
    {} as AdminState
  );

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  const label = "mb-1 block text-sm font-semibold";

  return (
    <div>
      {edit && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            ✏️ 編輯固定訂位
            {onCloseEdit && (
              <button
                type="button"
                onClick={onCloseEdit}
                className="ml-3 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                取消編輯
              </button>
            )}
          </h2>
        </div>
      )}
      <form action={action} className="space-y-4">
        {edit && <input type="hidden" name="id" value={recurring!.id} />}
        {/* 明顯提示：改星期/時段會刪舊生成訂位再重生成 */}
        {edit && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            修改後，這個系列的舊訂位會清除、依新設定重新生成。
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>會員</label>
            <select name="memberId" className={field} required defaultValue={recurring?.memberId ?? ""}>
              <option value="" disabled>
                選擇會員
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.phone ? `（${m.phone}）` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>場地</label>
            <select name="courtId" className={field} required defaultValue={recurring?.courtId ?? ""}>
              <option value="" disabled>
                選擇場地
              </option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.venueName} · {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>
              星期 <span className="text-xs text-rose-500">必選</span>
            </label>
            <select
              name="dayOfWeek"
              className={field}
              required
              defaultValue={recurring ? String(recurring.dayOfWeek) : ""}
            >
              <option value="" disabled>
                （請選擇星期）
              </option>
              {DOW.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>開始時間</label>
            <select name="startTime" className={field} defaultValue={recurring?.startTime ?? "20:00"}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>時長</label>
            <select name="durationMinutes" className={field} defaultValue={String(recurring?.durationMinutes ?? 120)}>
              {DUR.map((m) => (
                <option key={m} value={m}>
                  {m / 60 >= 1 ? `${m / 60} 小時` : `${m} 分`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>起始日期</label>
            <input
              type="date"
              name="startDate"
              className={field}
              defaultValue={recurring?.startDate ?? localDateString(new Date())}
              required
            />
          </div>
          <div>
            <label className={label}>終止日期（留空 = 長期）</label>
            <input type="date" name="endDate" className={field} defaultValue={recurring?.endDate ?? ""} />
          </div>
          <div>
            <label className={label}>備註（選填）</label>
            <input
              type="text"
              name="note"
              className={field}
              placeholder="例：週六羽球隊 / 李教練課程"
              defaultValue={recurring?.note ?? ""}
            />
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {state.error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending && <Spinner />}
            {pending
              ? "儲存中…（勿重複點擊）"
              : edit
                ? "儲存修改"
                : "＋ 建立固定訂位"}
          </button>
        </div>
      </form>
    </div>
  );
}
