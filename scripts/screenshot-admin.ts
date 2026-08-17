import puppeteer from "puppeteer-core";
import { SignJWT } from "jose";
import Database from "better-sqlite3";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-change-me-please-use-a-long-random-string"
);

async function main() {
  const db = new Database("prisma/dev.db");
  const admin = db
    .prepare("SELECT id FROM Member WHERE email = ?")
    .get("admin@difly.tw") as { id: string } | undefined;
  db.close();
  if (!admin) throw new Error("找不到管理員");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);

  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1600 });
  await page.setCookie({
    name: "difly_session",
    value: token,
    domain: "localhost",
    path: "/",
  });
  await page.goto("http://localhost:3000/admin", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 2500)); // 等週表 fetch 完成
  await page.screenshot({ path: "/tmp/admin-dashboard.png", fullPage: true });
  await browser.close();
  console.log("OK /tmp/admin-dashboard.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
