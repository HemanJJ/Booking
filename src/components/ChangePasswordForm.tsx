"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function ChangePasswordForm({
  hasPassword,
}: {
  hasPassword: boolean;
}) {
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="space-y-4">
      {hasPassword && (
        <div>
          <label className="mb-1 block text-sm font-semibold">目前密碼</label>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className={inputCls}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold">新密碼</label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="至少 6 個字元"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">確認新密碼</label>
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="再次輸入新密碼"
          className={inputCls}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          密碼已更新 ✅ 下次登入請用新密碼。
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "儲存中…" : "更新密碼"}
      </button>
    </form>
  );
}
