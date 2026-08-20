// LINE Rich Menu 設定工具（球場系統用）
// 用法:
//   npx tsx scripts/richmenu.ts list
//   npx tsx scripts/richmenu.ts create <圖片路徑>
//   npx tsx scripts/richmenu.ts upload <menuId> <圖片路徑>
//   npx tsx scripts/richmenu.ts set-default <menuId>
//   npx tsx scripts/richmenu.ts delete <menuId>
// 環境變數: LINE_MESSAGING_ACCESS_TOKEN
import "dotenv/config";
import { readFileSync } from "node:fs";

const TOKEN = process.env.LINE_MESSAGING_ACCESS_TOKEN ?? "";
const API = "https://api.line.me/v2/bot/richmenu";

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${TOKEN}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function contentType(path: string): string {
  return /\.jpe?g$/i.test(path) ? "image/jpeg" : "image/png";
}

// 6 格（2 直行 × 3 橫列），2500×1686
const AREAS = [
  { x: 0, y: 140, w: 1250, h: 515, label: "查詢訂單", type: "message", text: "查詢訂單" },
  { x: 1250, y: 140, w: 1250, h: 515, label: "預訂場地", type: "uri", uri: "https://liff.line.me/1660947211-e5z12ax6" },
  { x: 0, y: 655, w: 1250, h: 515, label: "價目表", type: "message", text: "價目表" },
  { x: 1250, y: 655, w: 1250, h: 515, label: "我的訂位", type: "uri", uri: "https://difly-booking.vercel.app/bookings" },
  { x: 0, y: 1170, w: 1250, h: 516, label: "用品商城", type: "message", text: "用品商城" },
  { x: 1250, y: 1170, w: 1250, h: 516, label: "聯絡客服", type: "message", text: "客服" },
];

function buildMenu(name: string) {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name,
    chatBarText: "開啟選單",
    areas: AREAS.map((a) => ({
      bounds: { x: a.x, y: a.y, width: a.w, height: a.h },
      action:
        a.type === "uri"
          ? { type: "uri", label: a.label, uri: a.uri }
          : { type: "message", label: a.label, text: a.text },
    })),
  };
}

async function list() {
  const r = await fetch(`${API}/list`, { headers: authHeaders() });
  const d = (await r.json()) as { richmenus?: Array<{ richMenuId: string; name: string; selected: boolean }> };
  if (r.status !== 200) return console.error("❌ 讀取失敗:", r.status, JSON.stringify(d));
  const menus = d.richmenus ?? [];
  if (!menus.length) console.log("目前沒有 Rich Menu");
  for (const m of menus) console.log(`  ${m.richMenuId}  名稱: ${m.name}  ${m.selected ? "✅預設" : ""}`);
}

async function uploadImage(id: string, imgPath: string) {
  const img = readFileSync(imgPath);
  const r = await fetch(`https://api-data.line.me/v2/bot/richmenu/${id}/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": contentType(imgPath) },
    body: img,
  });
  if (r.status !== 200) return console.error("❌ 上傳圖片失敗:", r.status, await r.text());
  console.log("✅ 圖片上傳完成");
}

async function create(imgPath: string) {
  if (!TOKEN) return console.error("❌ 請設定 LINE_MESSAGING_ACCESS_TOKEN");
  const name = `主選單-6格-${new Date().toISOString().slice(0, 10)}`;
  const r = await fetch(API, { method: "POST", headers: authHeaders(), body: JSON.stringify(buildMenu(name)) });
  const d = (await r.json()) as { richMenuId?: string };
  if (r.status !== 200) return console.error("❌ 建立失敗:", r.status, JSON.stringify(d));
  const id = d.richMenuId!;
  console.log("✅ 已建立:", id);
  await uploadImage(id, imgPath);
  await setDefault(id);
  console.log(`\n🎉 完成，請在 LINE 重新開啟 OA 確認。ID: ${id}`);
}

async function setDefault(id: string) {
  const r = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${id}`, { method: "POST", headers: authHeaders() });
  console.log(r.status === 200 ? "✅ 已設為預設 Rich Menu" : `⚠️ 設為預設失敗: ${r.status} ${await r.text()}`);
}

async function remove(id: string) {
  const r = await fetch(`${API}/${id}`, { method: "DELETE", headers: authHeaders() });
  console.log(r.status === 200 ? `✅ 已刪除 ${id}` : `❌ 刪除失敗: ${r.status}`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "list") list();
else if (cmd === "create") create(a);
else if (cmd === "upload") uploadImage(a, b);
else if (cmd === "set-default") setDefault(a);
else if (cmd === "delete") remove(a);
else console.log("用法: npx tsx scripts/richmenu.ts [list|create <img>|upload <id> <img>|set-default <id>|delete <id>]");
