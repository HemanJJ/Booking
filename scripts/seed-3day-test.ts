// 3 天測試資料產生器（排班拖移測試用）
// 昨天＋今天＋明天各排 5~7 筆，7 面場錯開、混合狀態/收款/來源
// 用法（打線上 Neon）：
//   DATABASE_URL="$(grep DATABASE_URL ../smartlocker/web/.env.local | cut -d= -f2- | tr -d '"')" npx tsx scripts/seed-3day-test.ts
// 本地 SQLite：npx tsx scripts/seed-3day-test.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  createBooking,
  markBookingPaid,
  type CreateBookingInput,
} from "../src/lib/booking";
import { localDateString } from "../src/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 每筆：{ courtIdx, start, dur, memberEmail, confirmed, paid, source } */
type Plan = {
  courtIdx: number; // 1~7（seed-court-N）
  start: string; // "HH:MM"
  dur: number; // 30 的倍數
  memberEmail: string;
  confirmed: boolean; // false = 保留中
  paid: boolean; // 已收現金
  source: "admin" | "member";
};

const DAYS: { label: string; days: number; plans: Plan[] }[] = [
  {
    label: "昨天（可測 no-show 標記／過去時段調整時長）",
    days: -1,
    plans: [
      { courtIdx: 1, start: "10:00", dur: 60, memberEmail: "demo01@difly.tw", confirmed: true, paid: true, source: "admin" },
      { courtIdx: 2, start: "14:00", dur: 90, memberEmail: "demo03@difly.tw", confirmed: true, paid: false, source: "member" },
      { courtIdx: 3, start: "19:00", dur: 90, memberEmail: "demo05@difly.tw", confirmed: true, paid: true, source: "admin" },
      { courtIdx: 4, start: "20:00", dur: 60, memberEmail: "demo07@difly.tw", confirmed: false, paid: false, source: "admin" },
      { courtIdx: 5, start: "09:00", dur: 90, memberEmail: "demo09@difly.tw", confirmed: true, paid: true, source: "member" },
    ],
  },
  {
    label: "今天（可測拖移／拉時長／點一下快速編輯）",
    days: 0,
    plans: [
      { courtIdx: 1, start: "08:00", dur: 60, memberEmail: "demo11@difly.tw", confirmed: true, paid: true, source: "admin" },
      { courtIdx: 2, start: "11:00", dur: 90, memberEmail: "demo13@difly.tw", confirmed: true, paid: true, source: "member" },
      { courtIdx: 3, start: "15:00", dur: 90, memberEmail: "demo15@difly.tw", confirmed: true, paid: false, source: "admin" },
      { courtIdx: 4, start: "17:00", dur: 90, memberEmail: "demo17@difly.tw", confirmed: true, paid: true, source: "member" },
      { courtIdx: 5, start: "19:00", dur: 120, memberEmail: "demo19@difly.tw", confirmed: true, paid: true, source: "admin" },
      { courtIdx: 6, start: "20:30", dur: 90, memberEmail: "demo02@difly.tw", confirmed: false, paid: false, source: "admin" },
      { courtIdx: 7, start: "13:00", dur: 60, memberEmail: "demo04@difly.tw", confirmed: true, paid: true, source: "member" },
    ],
  },
  {
    label: "明天（可測點空白格代客下單）",
    days: 1,
    plans: [
      { courtIdx: 1, start: "09:00", dur: 120, memberEmail: "demo06@difly.tw", confirmed: true, paid: true, source: "member" },
      { courtIdx: 2, start: "12:00", dur: 90, memberEmail: "demo08@difly.tw", confirmed: true, paid: true, source: "admin" },
      { courtIdx: 3, start: "14:00", dur: 60, memberEmail: "demo10@difly.tw", confirmed: false, paid: false, source: "admin" },
      { courtIdx: 4, start: "16:00", dur: 90, memberEmail: "demo12@difly.tw", confirmed: true, paid: true, source: "member" },
      { courtIdx: 5, start: "18:00", dur: 90, memberEmail: "demo14@difly.tw", confirmed: true, paid: false, source: "admin" },
      { courtIdx: 6, start: "20:00", dur: 60, memberEmail: "demo16@difly.tw", confirmed: true, paid: true, source: "member" },
      { courtIdx: 7, start: "21:30", dur: 90, memberEmail: "demo18@difly.tw", confirmed: true, paid: true, source: "admin" },
    ],
  },
];

async function main() {
  // 場地（依名稱排序，idx = seed-court-N 的 N 對應）
  const courts = await prisma.court.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
  });
  console.log(`場地 ${courts.length} 面`);
  const byIdx = new Map<number, (typeof courts)[number]>();
  for (const c of courts) {
    const m = c.name.match(/(\d+)\s*號場/);
    if (m) byIdx.set(Number(m[1]), c);
  }

  let ok = 0;
  let skipped = 0;
  for (const day of DAYS) {
    const date = dateOffset(day.days);
    console.log(`\n📅 ${day.label}（${date}）`);
    for (const p of day.plans) {
      const court = byIdx.get(p.courtIdx);
      if (!court) {
        console.log(`  ⏭️ 沒有 ${p.courtIdx} 號場，跳過`);
        skipped++;
        continue;
      }
      const member = await prisma.member.findUnique({
        where: { email: p.memberEmail },
      });
      if (!member) {
        console.log(`  ⏭️ 沒有會員 ${p.memberEmail}，跳過`);
        skipped++;
        continue;
      }

      const input: CreateBookingInput = {
        courtId: court.id,
        memberId: member.id,
        date,
        startTime: p.start,
        durationMinutes: p.dur,
        source: p.source,
        confirmed: p.confirmed,
        allowPast: true,
        note: "3天測試資料",
      };
      try {
        const b = await createBooking(input);
        if (p.paid && p.confirmed) await markBookingPaid(b.id, "cash");
        const [h, m] = p.start.split(":").map(Number);
        const endMin = h * 60 + m + p.dur;
        const end = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
        console.log(
          `  ✅ ${p.courtIdx} 號場 ${p.start}-${end} ${p.dur}分｜${member.name}｜${p.confirmed ? "已確認" : "保留中"}${p.paid ? "｜已收現金" : ""}`
        );
        ok++;
      } catch (e) {
        console.log(
          `  ⏭️ ${p.courtIdx} 號場 ${p.start} 衝突跳過：${e instanceof Error ? e.message : e}`
        );
        skipped++;
      }
    }
  }
  console.log(`\n🎉 完成：成功 ${ok} 筆、衝突跳過 ${skipped} 筆`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
