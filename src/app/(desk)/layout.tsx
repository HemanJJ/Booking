import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";

/** 櫃台模式 layout：全螢幕（無側欄、無頂欄），只做登入/權限檢查 */
export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/account/login?returnTo=%2Fdesk");
  if (member.role !== "admin" && member.role !== "staff") redirect("/");

  return <>{children}</>;
}
