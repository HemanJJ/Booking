// Prisma CLI 設定（v7）
// 依 DATABASE_URL 自動切換：本地 SQLite / 生產 PostgreSQL（Vercel + Neon）
import "dotenv/config";
import { defineConfig } from "prisma/config";

const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/migrations-postgres" : "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
