// no-show 自動化 smoke test（本地 dev.db）
// 用法：LINE_ADMIN_USER_IDS= npx tsx scripts/smoke-noshow.ts
process.env.LINE_ADMIN_USER_IDS = ""; // 測試不推送
process.env.LINE_ADMIN_USER_ID = "";

import { prisma } from "../src/lib/prisma";
import { markAttendance, autoMarkNoShows } from "../src/lib/noshow";

async function main() {
  // 1) 找一筆已結束的 confirmed 訂位（若無就建一筆測試）
  let target = await prisma.booking.findFirst({
    where: { status: "confirmed" },
    include: { member: true },
  });
  if (!target) {
    const court = await prisma.court.findFirst();
    const member = await prisma.member.findFirst();
    if (!court || !member) throw new Error("沒有場地/會員可建測試訂位");
    const booking = await prisma.booking.create({
      data: {
        courtId: court.id,
        memberId: member.id,
        date: "2026-08-01",
        startTime: "08:00",
        endTime: "09:00",
        durationMinutes: 60,
        totalPrice: 200,
        status: "confirmed",
        paymentStatus: "cash",
      },
    });
    target = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { member: true },
    });
    console.log("✅ 已建立測試訂位", target.id);
  }
  const before = target.member.noShowCount;

  // 2) 標記「未到」→ 累計 +1
  const r1 = await markAttendance(target.id, "noshow", "smoke-test");
  console.log("標記未到 →", JSON.stringify(r1), "（預期 noShowCount+1）");

  // 3) 反轉「已到場」→ 扣回
  const r2 = await markAttendance(target.id, "arrived", "smoke-test");
  console.log("反轉已到場 →", JSON.stringify(r2), "（預期扣回）");

  // 4) 自動判定掃描（不該誤標未結束的）
  const auto = await autoMarkNoShows();
  console.log("自動判定 →", JSON.stringify(auto), "（過去＋寬限期過才算）");

  // 5) 檢查恢復
  const after = await prisma.member.findUnique({
    where: { id: target.memberId },
    select: { noShowCount: true, banned: true },
  });
  console.log("會員最終狀態 →", JSON.stringify(after), "（預期 noShowCount 回到", before, "）");

  // 6) 清理測試訂位（若本次建立）
  if (target.date === "2026-08-01") {
    await prisma.booking.delete({ where: { id: target.id } });
    console.log("🧹 已刪除測試訂位");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  });
