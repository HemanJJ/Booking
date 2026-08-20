import { prisma } from "./prisma";

/**
 * 訂位稽核（logfile 機制）：記錄誰在何時對哪筆訂位做了什麼變更。
 * 記錄失敗不應中斷主流程，故吞掉錯誤只留 console。
 */
export async function logBookingEvent(opts: {
  bookingId?: string | null;
  actorName: string;
  action: string;
  detail: string;
}): Promise<void> {
  try {
    await prisma.bookingLog.create({
      data: {
        bookingId: opts.bookingId ?? null,
        actorName: opts.actorName,
        action: opts.action,
        detail: opts.detail,
      },
    });
  } catch (e) {
    console.error("[audit] logBookingEvent 失敗:", e);
  }
}
