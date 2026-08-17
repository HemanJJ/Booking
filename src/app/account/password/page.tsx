import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const metadata: Metadata = {
  title: "修改密碼",
};

export default async function ChangePasswordPage() {
  const member = await getCurrentMember();
  if (!member) {
    redirect("/account/login?returnTo=%2Faccount%2Fpassword");
  }

  const full = await prisma.member.findUnique({ where: { id: member.id } });
  const hasPassword = Boolean(full?.passwordHash);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">修改密碼</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        {hasPassword
          ? "請先輸入目前密碼，再設定新密碼。"
          : "您目前以 LINE 登入，可在此設定一組密碼，之後就能用 Email＋密碼登入。"}
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ChangePasswordForm hasPassword={hasPassword} />
      </div>
    </div>
  );
}
