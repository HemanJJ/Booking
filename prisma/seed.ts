import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const FACILITIES = ["淋浴間", "空調", "停車場", "置物櫃", "飲水機", "WiFi"];

async function main() {
  console.log("開始建立種子資料…");

  // 管理員（後台登入用；生產環境請用 ADMIN_EMAIL / ADMIN_PASSWORD 設強密碼）
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@difly.tw";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.member.upsert({
    where: { email: adminEmail },
    update: { role: "admin" },
    create: {
      name: "管理員",
      email: adminEmail,
      passwordHash: adminHash,
      role: "admin",
    },
  });

  // 示範會員（前台登入用）
  const demoHash = await bcrypt.hash("demo1234", 10);
  await prisma.member.upsert({
    where: { email: "demo@difly.tw" },
    update: {},
    create: {
      name: "示範會員",
      email: "demo@difly.tw",
      phone: "0912-345-678",
      passwordHash: demoHash,
    },
  });

  // 單一場館：迪飛太平（24 小時營業）
  const venue = await prisma.venue.upsert({
    where: { id: "seed-venue-difei-taiping" },
    update: {
      name: "迪飛太平",
      location: "台中市太平區",
      openingTime: "08:00",
      closingTime: "24:00",
      status: "active",
    },
    create: {
      id: "seed-venue-difei-taiping",
      name: "迪飛太平",
      location: "台中市太平區",
      openingTime: "08:00",
      closingTime: "24:00",
      status: "active",
    },
  });

  // 價位規則（dayOfWeek：0=日 1=一 2=二 3=三 4=四 5=五 6=六）
  const upsertRule = async (r: {
    id: string;
    name: string;
    price: number;
    kind: "weekly" | "date";
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    date?: string;
  }) => {
    const data = {
      venueId: venue.id,
      name: r.name,
      price: r.price,
      kind: r.kind,
      dayOfWeek: r.dayOfWeek ?? null,
      startTime: r.startTime ?? null,
      endTime: r.endTime ?? null,
      date: r.date ?? null,
      active: "active",
    };
    await prisma.priceRule.upsert({
      where: { id: r.id },
      update: data,
      create: { id: r.id, ...data },
    });
  };

  // 平日（一~五）：08:00-17:00 離峰 300、17:00-24:00 尖峰 400
  for (const d of [1, 2, 3, 4, 5]) {
    await upsertRule({
      id: `seed-rule-off-${d}`,
      name: "離峰",
      price: 300,
      kind: "weekly",
      dayOfWeek: d,
      startTime: "08:00",
      endTime: "17:00",
    });
    await upsertRule({
      id: `seed-rule-peak-${d}`,
      name: "尖峰",
      price: 400,
      kind: "weekly",
      dayOfWeek: d,
      startTime: "17:00",
      endTime: "24:00",
    });
  }
  // 週六：08:00-24:00 尖峰 400
  await upsertRule({
    id: "seed-rule-peak-6",
    name: "尖峰",
    price: 400,
    kind: "weekly",
    dayOfWeek: 6,
    startTime: "08:00",
    endTime: "24:00",
  });
  // 週日：08:00-20:00 尖峰 400、20:00-24:00 離峰 300
  await upsertRule({
    id: "seed-rule-peak-0",
    name: "尖峰",
    price: 400,
    kind: "weekly",
    dayOfWeek: 0,
    startTime: "08:00",
    endTime: "20:00",
  });
  await upsertRule({
    id: "seed-rule-off-0",
    name: "離峰",
    price: 300,
    kind: "weekly",
    dayOfWeek: 0,
    startTime: "20:00",
    endTime: "24:00",
  });
  // 範例國定假日（整日尖峰；颱風假宣布後請在後台新增 date 規則）
  await upsertRule({
    id: "seed-rule-date-2026-10-10",
    name: "國慶日",
    price: 400,
    kind: "date",
    date: "2026-10-10",
  });
  console.log("價位規則：平日 08-17 離峰300 / 17-24 尖峰400、週六 08-24 尖峰、週日 08-20 尖峰 20-24 離峰＋範例國慶日");

  // 範例時長折扣：滿 2 小時折 100（僅限尖峰 400 的時段）
  await prisma.durationDiscount.upsert({
    where: { id: "seed-discount-2h-peak" },
    update: {
      venueId: venue.id,
      name: "滿 2 小時折 100",
      minMinutes: 120,
      fixedAmount: 100,
      tierPrice: 400,
      active: "active",
    },
    create: {
      id: "seed-discount-2h-peak",
      venueId: venue.id,
      name: "滿 2 小時折 100",
      minMinutes: 120,
      fixedAmount: 100,
      tierPrice: 400,
      active: "active",
    },
  });
  console.log("時長折扣：滿 2 小時折 100（僅尖峰 400）");

  // 7 面場
  for (let n = 1; n <= 7; n++) {
    await prisma.court.upsert({
      where: { id: `seed-court-${n}` },
      update: {
        venueId: venue.id,
        name: `${n} 號場`,
        pricePerHour: 400,
        featured: n <= 3,
        status: "active",
      },
      create: {
        id: `seed-court-${n}`,
        venueId: venue.id,
        name: `${n} 號場`,
        pricePerHour: 400,
        featured: n <= 3,
        description: "迪飛太平標準羽球場，專業地墊與照明。",
        facilities: {
          create: FACILITIES.map((name) => ({ name })),
        },
        images: {
          create: [
            { url: `/courts/court-${n}.svg`, sortOrder: 0 },
            { url: `/courts/court-${(n % 7) + 1}.svg`, sortOrder: 1 },
          ],
        },
      },
    });
    console.log(`場地：${venue.name} ${n} 號場`);
  }

  console.log("種子資料建立完成 ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
