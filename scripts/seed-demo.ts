// Demo 資料產生器（本地 SQLite 用）
// 產生：20 會員 + 10 個一週 2 日固定團 + 隨機 7 天訂位（平日18-22/假日09-22，1-2小時）
// 用法：npx tsx scripts/seed-demo.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createBooking, generateRecurringBookings, markBookingPaid } from "../src/lib/booking";
import { localDateString } from "../src/lib/utils";

const DOW_ALL = [0, 1, 2, 3, 4, 5, 6];
const pad = (n: number) => String(n).padStart(2, "0");
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: T[]): T => arr[rand(arr.length)];

function startTimeFor(dow: number): string {
  const weekend = dow === 0 || dow === 6;
  const startHour = weekend ? 9 + rand(13) : 18 + rand(3); // 假日 9-21、平日 18-20
  const startMin = pick([0, 30]);
  return `${pad(startHour)}:${pad(startMin)}`;
}

async function main() {
  // 1) 20 會員
  const members = [];
  for (let i = 1; i <= 20; i++) {
    const no = pad(i);
    const m = await prisma.member.upsert({
      where: { email: `demo${no}@difly.tw` },
      update: {},
      create: {
        name: `會員${no}`,
        email: `demo${no}@difly.tw`,
        phone: `0912${String(300000 + i * 137).slice(0, 6)}`,
      },
    });
    members.push(m);
  }
  console.log(`✅ 會員 ${members.length} 位`);

  const courts = await prisma.court.findMany({ where: { status: "active" }, orderBy: { name: "asc" } });
  console.log(`✅ 場地 ${courts.length} 面`);

  // 2) 10 個固定團，每團一週 2 日（= 20 筆規則）
  const today = localDateString();
  let ruleCount = 0;
  for (let g = 1; g <= 10; g++) {
    const court = pick(courts);
    const member = pick(members);
    const startTime = startTimeFor(pick(DOW_ALL));
    const duration = pick([60, 90, 120]);
    const day1 = pick(DOW_ALL);
    const day2 = pick(DOW_ALL.filter((d) => d !== day1));
    for (const dow of [day1, day2]) {
      await prisma.recurringBooking.create({
        data: {
          courtId: court.id,
          memberId: member.id,
          dayOfWeek: dow,
          startTime,
          durationMinutes: duration,
          startDate: today,
          endDate: null,
          note: `demo 固定團 ${g}`,
        },
      });
      ruleCount++;
    }
  }
  console.log(`✅ 固定團規則 ${ruleCount} 筆（10 團 × 2 日）`);
  const createdRecurring = await generateRecurringBookings();
  console.log(`✅ 固定團已生成 ${createdRecurring} 筆實體訂位`);

  // 3) 隨機 7 天訂位
  let ok = 0;
  let skipped = 0;
  for (let day = 0; day < 7; day++) {
    const d = new Date();
    d.setDate(d.getDate() + day);
    const date = localDateString(d);
    const dow = d.getDay();
    const n = 4 + rand(5); // 每天 4~8 筆
    for (let k = 0; k < n; k++) {
      const startTime = startTimeFor(dow);
      const duration = pick([60, 90, 120]);
      const r = Math.random();
      try {
        const b = await createBooking({
          courtId: pick(courts).id,
          memberId: pick(members).id,
          date,
          startTime,
          durationMinutes: duration,
          source: r < 0.6 ? "admin" : "member",
          confirmed: r < 0.8, // 80% 已確認、20% 保留中
          allowPast: true,
        });
        if (r < 0.6) await markBookingPaid(b.id, "cash"); // 60% 已收現金
        ok++;
      } catch {
        skipped++;
      }
    }
  }
  console.log(`✅ 隨機訂位：成功 ${ok} 筆、衝突跳過 ${skipped} 筆`);
  console.log("🎉 完成！npm run dev 後到 /admin 看效果");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
