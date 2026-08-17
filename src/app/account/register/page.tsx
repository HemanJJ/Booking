import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import RegisterForm from "@/components/RegisterForm";
import LineLoginButton from "@/components/LineLoginButton";

export const metadata: Metadata = {
  title: "會員註冊",
};

export default async function RegisterPage() {
  const member = await getCurrentMember();
  if (member) redirect("/bookings");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">會員註冊</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        建立帳號，開始預約您的運動時光。
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RegisterForm />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        或
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <LineLoginButton />

      <p className="mt-8 text-center text-sm text-slate-600">
        已經有帳號？{" "}
        <Link
          href="/account/login"
          className="font-semibold text-emerald-700 hover:underline"
        >
          直接登入
        </Link>
      </p>
    </div>
  );
}
