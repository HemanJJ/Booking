import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import LineLoginButton from "@/components/LineLoginButton";

export const metadata: Metadata = {
  title: "會員登入",
};

const ERROR_MESSAGES: Record<string, string> = {
  line_not_configured:
    "LINE Login 尚未設定。請在 .env 填入 LINE_CHANNEL_ID、LINE_CHANNEL_SECRET 與 LINE_CALLBACK_URL。",
  line_cancelled: "您已取消 LINE 登入。",
  line_invalid: "LINE 登入請求無效，請再試一次。",
  line_invalid_state: "LINE 登入狀態已過期，請再試一次。",
  line_error: "LINE 登入失敗，請再試一次。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;
  const member = await getCurrentMember();
  if (member) redirect("/bookings");

  const target = returnTo ?? "/bookings";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">會員登入</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        登入後即可預約場地、管理訂位。
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {ERROR_MESSAGES[error] ?? "登入發生錯誤，請再試一次。"}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm returnTo={target} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        或
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <LineLoginButton />

      <p className="mt-8 text-center text-sm text-slate-600">
        還沒有帳號？{" "}
        <Link
          href="/account/register"
          className="font-semibold text-emerald-700 hover:underline"
        >
          立即註冊
        </Link>
      </p>
    </div>
  );
}
