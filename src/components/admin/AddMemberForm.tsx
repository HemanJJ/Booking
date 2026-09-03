"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  createMemberAction,
  updateMemberAction,
  type AdminState,
} from "@/app/admin/actions";
import Spinner from "@/components/Spinner";

export type MemberEditable = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function AddMemberForm({
  member,
}: {
  member?: MemberEditable | null;
}) {
  const edit = !!member;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    edit ? updateMemberAction : createMemberAction,
    {} as AdminState
  );

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";
  const label = "mb-1 block text-sm text-slate-600";

  const form = (
    <form action={action} className="mt-4 space-y-3">
      {edit && <input type="hidden" name="id" value={member!.id} />}
      <div>
        <label className={label}>姓名 *</label>
        <input
          name="name"
          required
          autoFocus
          defaultValue={member?.name ?? ""}
          className={field}
          placeholder="會員姓名"
        />
      </div>
      <div>
        <label className={label}>Email</label>
        <input
          name="email"
          type="email"
          defaultValue={member?.email ?? ""}
          className={field}
          placeholder="選填"
        />
      </div>
      <div>
        <label className={label}>手機</label>
        <input
          name="phone"
          type="tel"
          autoComplete="off"
          defaultValue={member?.phone ?? ""}
          className={field}
          placeholder="選填"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Spinner />}
          {pending ? "存檔中…（勿重複點擊）" : edit ? "儲存修改" : "建立會員"}
        </button>
        {!edit && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );

  if (edit) return form;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">新增會員（人工登打）</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          {open ? "收合" : "＋ 新增會員"}
        </button>
      </div>
      {open && form}
    </div>
  );
}
