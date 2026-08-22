import { prisma } from "./prisma";
import { TAIWAN_OFFSET_MS } from "./utils";
import { logBookingEvent } from "./audit";
import { sendLineAdminNotify } from "./notify";

/**
 * no-show（未到場）自動化
 * 規則（13-營業規則）：累計 3 次 no-show → 永久停權；管理員可人工解除。
 * - attendance 欄位：pending(未判定) | arrived(已到場) | noshow(未到)
 * - Member.noShowCount：累計未到次數
 */

/** 寬限期：訂位結束後多久內仍可補標「已到場」？超過則自動判定 no-show
 *  （24h：給櫃台一整天的補標時間，避免打完球沒多久就誤判） */
export const NO_SHOW_GRACE_HOURS = 24;
/** 累計幾次 no-show 自動永久停權 */
export const NO_SHOW_BAN_THRESHOLD = 3;

/** 訂位結束時間（台灣時區）＋寬限期後是否已過 */
function isEndedWithGrace(date: string, endTime: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = endTime.split(":").map(Number);
  const endUtcMs = Date.UTC(y, m - 1, d, hh, mm) - TAIWAN_OFFSET_MS;
  return endUtcMs + NO_SHOW_GRACE_HOURS * 60 * 60 * 1000 <= Date.now();
}

/** 訂位結束時間是否已過（不含寬限期；後台「標記到場」按鈕的顯示條件） */
export function isBookingEnded(date: string, endTime: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = endTime.split(":").map(Number);
  const endUtcMs = Date.UTC(y, m - 1, d, hh, mm) - TAIWAN_OFFSET_MS;
  return endUtcMs <= Date.now();
}

/**
 * 標記訂位到場狀態（後台人工）。
 * - arrived：已到場（不計 no-show；若先前誤標 noshow，扣回計數）
 * - noshow：未到（累計 noShowCount；達 3 次自動永久停權）
 * - pending：清除標記（誤標補救，同 arrived 扣回邏輯）
 * 回傳停權狀態與最新累計次數。
 */
export async function markAttendance(
  bookingId: string,
  attendance: "arrived" | "noshow" | "pending",
  actorName: string
): Promise<{ banned: boolean; noShowCount: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      member: true,
      court: { include: { venue: true } },
    },
  });
  if (!booking) throw new Error("訂位不存在");
  if (booking.status !== "confirmed") {
    throw new Error("只有已確認的訂位可以標記到場");
  }

  const prev = booking.attendance; // 先前標記
  let noShowCount = booking.member.noShowCount;

  if (attendance === "noshow") {
    if (prev !== "noshow") noShowCount += 1;
  } else {
    // arrived / pending：非 no-show
    if (prev === "noshow") noShowCount = Math.max(0, noShowCount - 1);
  }

  const banned =
    noShowCount >= NO_SHOW_BAN_THRESHOLD ? true : booking.member.banned;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { attendance, attendanceAt: new Date() },
    }),
    prisma.member.update({
      where: { id: booking.memberId },
      data: { noShowCount, banned },
    }),
  ]);

  const label = { arrived: "已到場", noshow: "未到(no-show)", pending: "清除標記" }[
    attendance
  ];
  await logBookingEvent({
    bookingId,
    actorName,
    action: "attendance",
    detail: `${label}｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}｜會員 ${booking.member.name}｜累計未到 ${noShowCount} 次${banned ? "（達 3 次已停權）" : ""}`,
  });

  if (attendance === "noshow") {
    await sendLineAdminNotify(
      `🚫 no-show｜${booking.member.name}｜${booking.court.venue.name} ${booking.court.name}｜${booking.date} ${booking.startTime}-${booking.endTime}｜累計 ${noShowCount}/${NO_SHOW_BAN_THRESHOLD} 次${banned ? " ⛔️ 已自動停權" : ""}`,
      "instant"
    );
  }

  return { banned, noShowCount };
}

/**
 * 自動判定（cron 每小時呼叫）：
 * 掃「已確認＋已結束（含寬限期）＋未標記」的訂位 → 標記 noshow、累計、
 * 達 3 次自動停權。回傳本次處理筆數與停權人數。
 *
 * ⚠️ 通知策略（2026-08-22 修正）：
 * 自動判定**不逐筆發 LINE 通知**——一次掃到多筆舊訂位會瞬間轟炸店家 LINE
 * （曾把 LINE 每月免費額度一次用完）。改為：只寫 logfile（後台「異動紀錄」可查），
 * 並在「有人達 3 次停權」時發一封彙整通知。人工標記（後台點「未到」）才逐筆通知。
 */
export async function autoMarkNoShows(): Promise<{
  marked: number;
  banned: number;
}> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      attendance: "pending",
    },
    include: {
      member: true,
      court: { include: { venue: true } },
    },
  });

  let marked = 0;
  let banned = 0;
  const bannedNames: string[] = [];
  for (const b of candidates) {
    if (!isEndedWithGrace(b.date, b.endTime)) continue;

    const noShowCount = b.member.noShowCount + 1;
    const nowBanned = noShowCount >= NO_SHOW_BAN_THRESHOLD;

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: b.id },
        data: { attendance: "noshow", attendanceAt: new Date() },
      }),
      prisma.member.update({
        where: { id: b.memberId },
        data: { noShowCount, banned: nowBanned || b.member.banned },
      }),
    ]);

    await logBookingEvent({
      bookingId: b.id,
      actorName: "系統",
      action: "attendance",
      detail: `自動判定未到(no-show)｜${b.court.venue.name} ${b.court.name}｜${b.date} ${b.startTime}-${b.endTime}｜會員 ${b.member.name}｜累計未到 ${noShowCount} 次${nowBanned ? "（達 3 次已停權）" : ""}`,
    });

    marked++;
    if (nowBanned) {
      banned++;
      bannedNames.push(b.member.name);
    }
  }

  // 彙整通知：只有「有人被停權」才發一封（避免逐筆轟炸）
  if (bannedNames.length > 0) {
    await sendLineAdminNotify(
      `⛔️ 自動停權通知｜本次 ${bannedNames.length} 位會員累計 3 次未到已永久停權：${bannedNames.join("、")}。詳見後台「異動紀錄」。`,
      "instant"
    );
  }
  return { marked, banned };
}
