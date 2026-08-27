---
tags: [difly, 智慧拍櫃, smartlocker, 穿線]
created: 2026-08-20
---

# 智慧拍櫃 smartlocker（穿線服務）

> 智慧拍櫃是**硬體**（格口鎖控板＋kiosk），做**羽拍穿線**。雲端原地取代（同一 Vercel＋Neon＋LINE bot）。註：歷史文件寫「租拍」是筆誤，實為穿線。

## 一句話定位

「智慧拍櫃」= **實體格口**（客人放拍/取拍）＋ **kiosk**（下單/列印）＋ **雲端**（Vercel+Neon+LINE）。目前雲端（穿線閉環）已完成、格口 22 格，硬體（列印/485）進行中。**先跑太平一店，架構可擴大到多店**（venues 表分店）。

## 三層結構

| 層 | 位置 | 狀態 |
|----|------|------|
| 雲端（web） | `code/smartlocker/web` | ✅ 上線（含穿線 API） |
| 規格文件 | `code/stringing/` | ✅ 定稿＋已 push |
| 硬體 | **Win10** kiosk＋**GPRINTER GP-3120TN** 標籤機＋RS-485 鎖控板 | 印表機 ✅；485 ⏳ |

- 雲端網址：`https://shop.dearfly.com.tw`（原 `smartlocker-alpha` 已改）
- 部署（從 repo 根目錄）：`cd smartlocker && VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… npx vercel --prod`
  ⚠️ 不要從 `web/` 內跑（Root Directory 已設 `web`，跑錯會 404）
- 健康檢查：`/api/health`（已接 UptimeRobot）
- 資料庫：與 booking **共用同一個 Neon**（見 [[15-營運維護]] 地雷）

## 硬體架構（dashboard 整理）

| 硬體 | 用途 | 備註 |
|------|------|------|
| UPUS-SKB 鎖控板 | 格口開關 | **485 尚未通**（排查見 smartlocker/README.md） |
| Win10/Win7 kiosk | 下單＋列印 | 編譯需在 Win 跑 `src/build.bat` |
| GPRINTER **GP-3120TN** 標籤機 | 印 4×3cm 直式標籤（線種+色/磅數/金額/取件號＋店名） | ✅ 已定稿：**Seagull 驅動＋微軟正黑印中文**（`print-label.ps1`）。⚠️ 單字節字型、**不吃 BITMAP**、無內建中文 → raw TSPL 印中文不可行 |
| RS-485 | 控制格口 | 待整合（SkbBridge 或新寫） |
| Pi | （可選） | 見 `smartlocker/pi/README.md` |

## 常用指令（來自工作站 dashboard）

```bash
bash code/smartlocker/快速模擬.command                    # 一鍵模擬（模擬板+kiosk輪詢）
python3 code/smartlocker/tools/skb_probe.py sweep         # 驗板（485/TTL）
python3 code/smartlocker/tools/setup-richmenu.py list     # LINE 圖文選單
node code/smartlocker/simulator/mock-485.mjs              # 485 模擬板 + 22 格看板
bash code/smartlocker/tools/one-click-ngrok.sh            # 外網 Demo
open code/smartlocker/kiosk/README-kiosk.md               # Win 建置手冊
```

## 常用網址

| 用途 | 網址 |
|------|------|
| Kiosk 下單（穿線） | `https://shop.dearfly.com.tw/order` |
| 員工後台 | `https://shop.dearfly.com.tw/admin` |
| 線種管理（店長自行加線） | `https://shop.dearfly.com.tw/admin/strings` |
| 下單 UI 打樣 | `https://shop.dearfly.com.tw/kiosk-mockup.html` |
| 格口模擬板（本機） | `http://localhost:4321/` |

## 穿線狀態機（見 [[12-穿線服務]]）

`待收件 → 穿線中 → 待取件 → 已完成`（+ `paid` 付款狀態）。**格子是流動的**：交拍格 ≠ 取件格。

## 前台下單（2026-08-24 改版：品牌分組、一框無滑）

- `/order`＝**4 屏 drill-down**（品牌 → 線種 → 磅數＋顏色 → 確認），每屏一框、大熱區、無 scroll。品牌 chips／線種 grid 全依 `strings.brand` 動態生成 → 48+ 線種照樣擴充（加品牌就行）。
- **線種管理**：員工後台 `admin/strings`，店長自行新增/編輯/停用（`upsertString`/`updateString`/`disableString`）。`brand` 自動推導（`splitBrand`：AL/YOUNG/BG/KIZUNA/DEARFLY，否則取第一個詞）。
- **首頁**（`/`）：寄拍穿線（綠，圖＝**VICTOR 穿線機 SVG**）、羽球用品（藍）、泡麵（橘）、取件（**粉桃紅 #ec4899**，跟泡麵橘分開、非警示色）。穿線圖元件＝`web/src/components/StringMachineIcon.tsx`。
- 強制淺色底 `#f4f6f8`（照打樣，避免系統深色模式對比差）。

## 目前進度

| 部分 | 狀態 |
|------|------|
| 雲端閉環（資料模型/下單/後台/列印佇列/LINE 通知） | ✅ 完成、已上線（25/25 本地＋9/9 Neon e2e） |
| 列印（實體） | ✅ **已定稿**（2026-08-23）：Seagull 驅動＋Windows 中文字型印中文（`print-label.ps1`）。⚠️ raw TSPL 印中文**不可行**（單字節字型＋不吃 BITMAP）。**`-NoPrint` 開關**：印表機移除時設此旗標→略過列印，其餘照常 |
| 串接服務 Web App 增強 | ✅ 顏色功能(`strings.colors`)+訂單頁+Rich Menu 6 格（`shop.dearfly.com.tw`） |
| 線種品牌分組＋店長管理 | ✅ 2026-08-24：`brand` 欄位＋`/admin/strings` 自行新增/編輯/停用（48+ 線種擴充，不需發版） |
| 下單頁品牌分組一框無滑 | ✅ 2026-08-24：`/order` 4 屏 drill-down + 首頁改色/穿線機 SVG（見「前台下單」） |
| 格口控制（RS-485） | ⏳ 未動工（串接方案見 [[18-運動商城與進銷存]]／販售規格）|
| 販售＋進銷存＋配貨 | ✅ 2026-08-21 完成（見 [[18-運動商城與進銷存]]）|

## 300 店擴展（2026-08-23 定方向）

- 標籤內容是**動態**的（每筆訂單的線種/磅數/金額/取件號 + 該店店名）。
- **列印**：用「Seagull 驅動印中文」同一套方法（`print-label.ps1`），每店 kiosk 跑 `kiosk-poller.mjs`、塞入店名＋訂單資料 → **300 店一致、不需 per-store 灌字型**。
- **自動帶（已做＋已驗證）**：`kiosk-print-poller.ps1`（PowerShell，kiosk 無 node 可跑）輪詢 `print_jobs` → 用訂單 `label_data` 自動組標籤4行（線種+色[note]/磅數/金額/取件號+格號）→ 呼叫 `print-label.ps1 -ConfigFile`（中文，含色"白"）；店名從環境變數 `STORE`/`STORE_EN` 帶入。**kiosk 用 `schtasks`「KioskPrintPoller」常駐**、`PrintDocument` 直印（**背景靜默、無對話框**）。⚠️ 用 `HttpWebRequest+UTF8` 解碼 API（Invoke-RestMethod 會把中文色弄成亂碼）。
- **店名**：繁體店名（太平永成店/長壽店…）用微軟正黑全覆蓋；紙張用驅動內建 `40 mm x 30 mm`。
- **不要**走「下載 `.BF2` 字型到印表機」這條（找不到繁體檔＋印表機可能不吃 DOWNLOAD，300 店會超麻煩）。

## demo/開發環境與近期改動（2026-08-26/27）

### 三套環境（正式／網外 demo／本機開發）
| 系統 | 正式 | 網外 demo | 本機開發 |
|------|------|-----------|----------|
| 智慧拍櫃（穿線+進銷存） | shop.dearfly.com.tw | **demo.dearfly.com.tw**（後台 demo1234） | `smartlocker-demo`，localhost:3000 |
| 羽球場預約 booking | dearfly.com.tw | **booking-demo.dearfly.com.tw**（admin@difly.tw / demo1234，登入 /account/login） | `booking-demo`，localhost:3001（SQLite 離線） |

- 兩套 demo 都是**獨立資料庫、獨立 Vercel 專案**，隨便增刪查不碰正式。外人直接開 demo 網址即可試客人端，後台用 demo1234。
- 一鍵啟動：工作站 Dashboard「🔐 智慧拍櫃 Web」「🏸 羽球場預約」＋各資料夾 `🚀 啟動…command`。
- booking demo：資料庫 Neon `booking-demo`（Postgres）；本機用 SQLite（`prisma.config.ts` 依 DATABASE_URL 自動切 SQLite/Postgres）。
- **進銷存 demo 是多店結構**：迪飛太平(分店)＋迪飛總倉＋迪飛長壽店(分店)，供「配貨 總倉→店家」示範。

### 近期 UI／功能
- **favicon**：換成迪飛自有 icon（移除 Vercel 預設），smartlocker＋booking 兩站都換。
- **版權宣告**：右下角「© 2026 迪飛羽球館 All Rights Reserved.」＋「System by SEQO」（連結 SEQO landing）。
- **/order 步驟導引**：右上「1/4」＋一排字 → 改「物流式 4 階段進度條」（icon＋打勾＋連線，當前亮綠）。
- **線種上架/停售開關**：`/admin/strings` 新增＋編輯都顯示「在售/停售」下拉；停用列有「上架」鈕。
- **後台深色模式修復**：各 admin 頁強制淺底(#f5f5f5)＋深字，避免系統深色模式白字糊掉。

### bug 修復（全新空庫才會踩）
- `vending.ts` 種子 `ON CONFLICT (sku)` → `(venue_id, sku)`（多店唯一鍵）。
- `ensureVendingSchema` 補 `min_qty` 欄位（listAllInventory 有查、但只有進銷存 ensureStockSchema 才加）。

### Vercel 坑（新建專案必看）
- 新專案 **Framework Preset 預設「Other」**（不是 Next.js）→ 整站 404。`vercel project update <name> --framework nextjs --yes`。
- 新專案預設開 **SSO 部署保護** → `.vercel.app` 未登入導去 vercel.com。`vercel project protection disable <name> --sso`。
- 子網域：`vercel domains add <sub>.<domain> <project>`，再在第三方 DNS（ns1.ix1000.com）加 CNAME。

## 注意 / 地雷

- ⚠️ **Root Directory 已修**（2026-08-20 設 `web`），否則 `git push` 會把 production 搞 404。
- ⚠️ LINE `CHANNEL_ACCESS_TOKEN` **不要按 Reissue**（按了 token 失效要手動更新）。
- ⚠️ 工作站 dashboard 裡 stringing 還寫「待開發」、booking 寫「6 場地」——**已過時**，實況以本知識庫為準。

## 相關

- [[12-穿線服務]]
- [[15-營運維護]]
- [[09-算帳與估價]]
