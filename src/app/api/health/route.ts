import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 健康檢查：測資料庫連線。
 * 供 UptimeRobot 等外部監控打（網址 https://difly-booking.vercel.app/api/health）。
 * 正常回 200 { ok:true }；DB 掛了回 500 { ok:false }。
 */
export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ ok: true, t: Date.now() });
  } catch {
    return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  }
}
