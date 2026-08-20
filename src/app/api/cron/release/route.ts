import { NextResponse } from "next/server";
import {
  releaseExpiredBookings,
  generateRecurringBookings,
} from "@/lib/booking";

export const dynamic = "force-dynamic";

/**
 * 定期維護（Vercel Cron 觸發，見 vercel.json crons）：
 * 1) 釋放逾期未付款訂位；2) 生成未來 4 週的固定訂位。
 * 建議在 Vercel 設定 CRON_SECRET，並於 cron 設定的 header 帶
 * `Authorization: Bearer <CRON_SECRET>`。
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const released = await releaseExpiredBookings();
  const created = await generateRecurringBookings();
  return NextResponse.json({ ok: true, released, created });
}
