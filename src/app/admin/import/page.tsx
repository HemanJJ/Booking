import type { Metadata } from "next";
import ImportBookingsForm from "@/components/admin/ImportBookingsForm";

export const metadata: Metadata = {
  title: "批次匯入",
};

export default function AdminImportPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">批次匯入（人工接單補登）</h1>
      <p className="mb-6 text-sm text-slate-500">
        網站掛掉期間用 Excel 接的單，網站修好後貼回來一鍵補登。
        自動算價＋防重疊，時段被佔的會跳過並列出。
      </p>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ImportBookingsForm />
      </div>
    </div>
  );
}
