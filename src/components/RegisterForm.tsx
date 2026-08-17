"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold">姓名</label>
        <input name="name" required placeholder="您的姓名" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">手機號碼</label>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0912-345-678"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">密碼</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="至少 6 個字元"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">確認密碼</label>
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="再次輸入密碼"
          className={inputCls}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "註冊中…" : "註冊"}
      </button>
    </form>
  );
}
