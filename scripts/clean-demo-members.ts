// 清 demo 會員（只動 demo，保留 admin／真實會員／前端與設定）
// demo 判定：email 開頭 demo + 結尾 @difly.tw（會員01~20 = demo01~20@difly.tw；示範會員 = demo@difly.tw）
//
// 用法（連線上 Neon）：
//   DATABASE_URL="postgresql://...pooled...?sslmode=require" npx tsx scripts/clean-demo-members.ts            # dry-run，只看不清
//   DATABASE_URL="postgresql://...pooled...?sslmode=require" npx tsx scripts/clean-demo-members.ts --backup   # 備份到 backups/ 後清除
//   DATABASE_URL="postgresql://...pooled...?sslmode=require" npx tsx scripts/clean-demo-members.ts --apply    # 直接清（--apply 會先備份）
//
// 安全設計：預設 dry-run；必須提供 DATABASE_URL；--apply 前一律先備份；只清符合 demo 規則的會員。
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

function isDemoEmail(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e.startsWith("demo") && e.endsWith("@difly.tw");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const wantBackup = process.argv.includes("--backup") || apply;

  if (!process.env.DATABASE_URL) {
    console.error("❌ 未設定 DATABASE_URL（請指向 Neon 或本地 dev.db），為了安全不執行。");
    process.exit(1);
  }
  const isPg = process.env.DATABASE_URL.startsWith("postgres");

  const all = await prisma.member.findMany();
  const demo = all.filter((m) => isDemoEmail(m.email));

  if (demo.length === 0) {
    console.log("✅ 沒有 demo 會員（email 為 demo%@difly.tw），不需清除。");
    return;
  }

  console.log(`\n⚠️  將處理 ${demo.length} 位 demo 會員（${isPg ? "線上 Neon" : "本地"}）`);
  for (const m of demo) {
    const [bookings, recurring, orders] = await Promise.all([
      prisma.booking.count({ where: { memberId: m.id } }),
      prisma.recurringBooking.count({ where: { memberId: m.id } }),
      prisma.order.count({ where: { memberId: m.id } }),
    ]);
    console.log(`   - ${m.name} <${m.email}> 訂位 ${bookings}｜固定團 ${recurring}｜訂單 ${orders}`);
  }

  if (!apply) {
    console.log("\n（預設 dry-run：未動任何資料。確認清單無誤後，加 --apply 才會真的清除）");
    return;
  }

  if (wantBackup) {
    const dir = path.join(process.cwd(), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `demo-members-${stamp}.json`);
    const snap = [];
    for (const m of demo) {
      const [bookings, recurring, orders] = await Promise.all([
        prisma.booking.findMany({ where: { memberId: m.id } }),
        prisma.recurringBooking.findMany({ where: { memberId: m.id } }),
        prisma.order.findMany({ where: { memberId: m.id } }),
      ]);
      snap.push({ member: m, bookings, recurring, orders });
    }
    fs.writeFileSync(file, JSON.stringify(snap, null, 2));
    console.log(`\n✅ 已備份 ${demo.length} 位 demo 會員與其關聯資料 → ${file}`);
  }

  for (const m of demo) {
    await prisma.member.delete({ where: { id: m.id } }); // 關聯資料依 schema onDelete:Cascade 一併移除
    console.log(`🗑  已刪除 ${m.name} <${m.email}>`);
  }
  console.log(`\n✅ 完成，共清除 ${demo.length} 位 demo 會員。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
