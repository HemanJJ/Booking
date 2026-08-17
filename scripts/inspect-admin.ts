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
  await new Promise((r) => setTimeout(r, 2500));

  const blocks = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("div").forEach((el) => {
      const c = el.className || "";
      if (c.includes("text-[11px]") && c.includes("bg-")) {
        const color = c.includes("bg-rose-100")
          ? "🔴紅(尖峰)"
          : c.includes("bg-sky-100")
            ? "🔵藍(離峰)"
            : c.includes("bg-amber-100")
              ? "🟡黃(跨時段)"
              : "?";
        out.push(`${color} | ${(el as HTMLElement).innerText.replace(/\n/g, " ").trim()}`);
      }
    });
    return out;
  });

  console.log(`=== 週表色塊共 ${blocks.length} 個 ===`);
  blocks.forEach((b) => console.log(" ", b));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
