"use client";

import { logoutAction } from "@/app/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
      >
        登出
      </button>
    </form>
  );
}
