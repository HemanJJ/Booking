import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { toggleMemberRoleAction } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "會員管理",
};

export default async function AdminMembersPage() {
  const [current, members] = await Promise.all([
    getCurrentMember(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">會員管理</h1>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">手機</th>
              <th className="px-4 py-3 font-medium">登入管道</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isAdmin = m.role === "admin";
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
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        管理員
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        會員
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <form action={toggleMemberRoleAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {isAdmin ? "取消管理員" : "設為管理員"}
                        </button>
                      </form>
                    )}
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
