import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import {
  toggleMemberRoleAction,
  toggleStaffAction,
  unlockMemberAction,
  banMemberAction,
} from "@/app/admin/actions";
import AddMemberForm from "@/components/admin/AddMemberForm";
import PendingSubmitButton from "@/components/PendingSubmitButton";

export const metadata: Metadata = {
  title: "會員管理",
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(["admin"]);
  const [current, members] = await Promise.all([
    getCurrentMember(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const { edit } = await searchParams;
  const editing = edit ? members.find((m) => m.id === edit) ?? null : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">會員管理</h1>
      {editing && (
        <Link
          href="/admin/members"
          className="mb-6 inline-block rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          ← 取消編輯
        </Link>
      )}

      <AddMemberForm
        member={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                email: editing.email,
                phone: editing.phone,
              }
            : undefined
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">手機</th>
              <th className="px-4 py-3 font-medium">登入管道</th>
              <th className="px-4 py-3 font-medium">點數</th>
              <th className="px-4 py-3 font-medium">未到次數</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">狀態</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isAdmin = m.role === "admin";
              const isStaff = m.role === "staff";
              const isSelf = m.id === current?.id;
              return (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {m.name}
                    {isSelf && (
                      <span className="ml-2 text-xs text-slate-400">（您）</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{m.email ?? "-"}</td>
                  <td className="px-4 py-3">{m.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    {m.lineUserId ? (
                      <span className="text-emerald-700">LINE</span>
                    ) : (
                      "帳號"
                    )}
                  </td>
                  <td className="px-4 py-3">{m.points}</td>
                  <td className="px-4 py-3">
                    {m.noShowCount > 0 ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          m.noShowCount >= 3
                            ? "bg-rose-100 text-rose-600"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {m.noShowCount} 次
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        管理員
                      </span>
                    ) : isStaff ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                        員工
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        會員
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.banned ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-600">
                        已停權
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">正常</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/members?edit=${m.id}`}
                        className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                      >
                        編輯
                      </Link>
                      {!isSelf && (
                        <form action={toggleStaffAction}>
                          <input type="hidden" name="id" value={m.id} />
                          <PendingSubmitButton className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50">
                            {isStaff ? "取消員工" : "設為員工"}
                          </PendingSubmitButton>
                        </form>
                      )}
                      {!isSelf && (
                        <form action={toggleMemberRoleAction}>
                          <input type="hidden" name="id" value={m.id} />
                          <PendingSubmitButton className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                            {isAdmin ? "取消管理員" : "設為管理員"}
                          </PendingSubmitButton>
                        </form>
                      )}
                      {!isSelf &&
                        (m.banned ? (
                          <form action={unlockMemberAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <PendingSubmitButton className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                              解鎖
                            </PendingSubmitButton>
                          </form>
                        ) : (
                          <form action={banMemberAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <PendingSubmitButton className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                              停權
                            </PendingSubmitButton>
                          </form>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
