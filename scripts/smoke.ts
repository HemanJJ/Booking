import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  createBooking,
  cancelBooking,
  getSlotsForDate,
} from "../src/lib/booking";
import { localDateString } from "../src/lib/utils";

async function main() {
  const member = await prisma.member.findUnique({
    where: { email: "demo@difly.tw" },
  });
  if (!member) throw new Error("示範會員不存在，請先 npx prisma db seed");

  const court = await prisma.court.findFirst({ orderBy: { createdAt: "asc" } });
  if (!court) throw new Error("場地不存在，請先 npx prisma db seed");

  const date = localDateString(new Date(Date.now() + 2 * 24 * 3600 * 1000));
  const slots = await getSlotsForDate(court.id, date);
  const avail = slots.filter((s) => s.available);
  if (avail.length < 2) throw new Error("可預約時段不足");

  const s1 = avail[0].startTime;
  const s2 = avail[1].startTime;
  const base = { courtId: court.id, memberId: member.id, date };

  // 1. 30 分鐘訂位（佔 1 格）
  const b1 = await createBooking({ ...base, startTime: s1, durationMinutes: 30 });
  console.log(`✓ 30 分鐘訂位 ${b1.id}（${date} ${s1}）`);

  // 2. 同一格重複 30 分鐘 → 應被拒
  let dupRejected = false;
  try {
    await createBooking({ ...base, startTime: s1, durationMinutes: 30 });
  } catch (e) {
    dupRejected = true;
    console.log(`✓ 重複訂位被拒：${(e as Error).message}`);
  }
  if (!dupRejected) throw new Error("重複訂位未被拒絕");

  // 3. 從 s1 起 60 分鐘（會重疊 s1）→ 應被拒
  let overlapRejected = false;
  try {
    await createBooking({ ...base, startTime: s1, durationMinutes: 60 });
  } catch (e) {
    overlapRejected = true;
    console.log(`✓ 重疊（跨格）訂位被拒：${(e as Error).message}`);
  }
  if (!overlapRejected) throw new Error("重疊訂位未被拒絕");

  // 4. 取消並確認釋放
  await cancelBooking(b1.id, member.id);
  console.log("✓ 取消訂位");
  const after = await getSlotsForDate(court.id, date);
  if (!after.find((s) => s.startTime === s1)?.available) {
    throw new Error("取消後時段未釋放");
  }
  console.log("✓ 時段已釋放");

  // 5. 60 分鐘訂位（跨 2 格）→ 成功，驗證多格訂位
  const b2 = await createBooking({ ...base, startTime: s1, durationMinutes: 60 });
  console.log(`✓ 60 分鐘訂位（佔 ${s1} + ${s2}）`);
  await cancelBooking(b2.id, member.id);
}

main()
  .then(() => {
    console.log("SMOKE OK ✅");
    process.exit(0);
  })
  .catch((e) => {
    console.error("SMOKE FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
