import "dotenv/config";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

// 重設 booking 後台管理員密碼（直連 Neon，別用本機 SQLite）
// 用法：
//   DATABASE_URL=<neon網址> NEW_ADMIN_PASSWORD=<新密碼> npx tsx scripts/reset-admin-password.ts
// 可選：ADMIN_EMAIL=<email>（預設 admin@difly.tw）

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) {
    console.error("❌ DATABASE_URL 不是 Neon 連線（別用本機 SQLite file:...）");
    process.exit(1);
  }
  const email = process.env.ADMIN_EMAIL ?? "admin@difly.tw";
  const password = process.env.NEW_ADMIN_PASSWORD;
  if (!password) {
    console.error("❌ 請設 NEW_ADMIN_PASSWORD");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const sql = neon(url);

  const updated = await sql`
    UPDATE "Member"
    SET "passwordHash" = ${hash}, role = 'admin'
    WHERE email = ${email}
    RETURNING id, email, role
  `;

  if (updated.length === 0) {
    await sql`
      INSERT INTO "Member" (id, name, email, "passwordHash", role)
      VALUES (gen_random_uuid(), '管理員', ${email}, ${hash}, 'admin')
    `;
    console.log(`✅ 會員不存在，已新建 admin：${email}`);
  } else {
    console.log(`✅ 已重設密碼：${email}（role=${updated[0].role}）`);
  }

  // 驗證：讀回 hash 用 bcrypt 比對
  const rows = await sql`SELECT "passwordHash" FROM "Member" WHERE email = ${email}`;
  const ok = rows.length > 0 && (await bcrypt.compare(password, rows[0].passwordHash));
  console.log(ok ? "✅ 驗證通過：新密碼可登入" : "❌ 驗證失敗，請檢查");
}

main().catch((e) => {
  console.error("❌ 失敗:", e);
  process.exit(1);
});
