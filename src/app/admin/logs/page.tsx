import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "異動紀錄",
};

const ACTION_LABEL: Record<string, { text: string; cls: string }> = {
  create: { text: "建立", cls: "bg-emerald-100 text-emerald-700" },
  update: { text: "改單", cls: "bg-sky-100 text-sky-700" },
  extend: { text: "加長時間", cls: "bg-emerald-100 text-emerald-700" },
  shorten: { text: "縮短時間", cls: "bg-amber-100 text-amber-700" },
  cancel: { text: "取消", cls: "bg-rose-100 text-rose-600" },
  pay: { text: "收款", cls: "bg-emerald-100 text-emerald-700" },
  unpaid: { text: "退回未收", cls: "bg-amber-100 text-amber-700" },
  release: { text: "自動釋放", cls: "bg-slate-100 text-slate-500" },
  linepay: { text: "LINE Pay", cls: "bg-emerald-100 text-emerald-700" },
};

function fmt(d: Date): string {
  return d.toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" });
}

export default async function AdminLogsPage() {
  await requireRole(["admin"]);
  const logs = await prisma.bookingLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">異動紀錄（logfile）</h1>

      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          尚無異動紀錄。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">時間</th>
                <th className="px-4 py-3 font-medium">操作者</th>
                <th className="px-4 py-3 font-medium">動作</th>
                <th className="px-4 py-3 font-medium">摘要</th>
                <th className="px-4 py-3 font-medium">訂位</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const a = ACTION_LABEL[l.action] ?? {
                  text: l.action,
                  cls: "bg-slate-100 text-slate-600",
                };
                return (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {fmt(l.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{l.actorName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.cls}`}
                      >
                        {a.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.detail}</td>
                    <td className="px-4 py-3">
                      {l.bookingId ? (
                        <span className="font-mono text-xs text-slate-400">
                          {l.bookingId.slice(0, 12)}…
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
