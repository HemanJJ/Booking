"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createMemberAction, type AdminState } from "@/app/admin/actions";
import Spinner from "@/components/Spinner";

export default function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createMemberAction,
    {} as AdminState
  );

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

      {open && (
        <form action={action} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">姓名 *</label>
            <input
              name="name"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="會員姓名"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Email</label>
            <input
              name="email"
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              placeholder="選填"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">手機</label>
            <input
              name="phone"
              type="tel"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
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
              {pending ? "存檔中…（勿重複點擊）" : "建立會員"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
