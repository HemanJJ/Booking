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
| 硬體 | **Win10** kiosk＋GoDex 印表機＋RS-485 鎖控板 | ⏳ 現場另做（方案 A：畫面住雲端）|

- 雲端網址：`https://smartlocker-alpha.vercel.app`
- 部署：`cd code/smartlocker/web && ./deploy.sh`（Root Directory 已設 `web`）
- 健康檢查：`/api/health`（已接 UptimeRobot）
- 資料庫：與 booking **共用同一個 Neon**（見 [[15-營運維護]] 地雷）

## 硬體架構（dashboard 整理）

| 硬體 | 用途 | 備註 |
|------|------|------|
| UPUS-SKB 鎖控板 | 格口開關 | **485 尚未通**（排查見 smartlocker/README.md） |
| Win10/Win7 kiosk | 下單＋列印 | 編譯需在 Win 跑 `src/build.bat` |
| GoDex EZ120 印表機 | 印 2×3" 貼紙（QR+線種+磅數+費用） | 對位需實測 |
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
| Kiosk 下單（穿線） | `https://smartlocker-alpha.vercel.app/order` |
| 員工後台 | `https://smartlocker-alpha.vercel.app/admin` |
| 格口模擬板（本機） | `http://localhost:4321/` |

## 穿線狀態機（見 [[12-穿線服務]]）

`待收件 → 穿線中 → 待取件 → 已完成`（+ `paid` 付款狀態）。**格子是流動的**：交拍格 ≠ 取件格。

## 目前進度

| 部分 | 狀態 |
|------|------|
| 雲端閉環（資料模型/下單/後台/列印佇列/LINE 通知） | ✅ 完成、已上線（25/25 本地＋9/9 Neon e2e） |
| 列印（雲端側） | ✅ 完成；GoDex 實體對位待硬體測 |
| 格口控制（RS-485） | ⏳ 未動工（串接方案見 [[18-運動商城與進銷存]]／販售規格）|
| 販售＋進銷存＋配貨 | ✅ 2026-08-21 完成（見 [[18-運動商城與進銷存]]）|

## 注意 / 地雷

- ⚠️ **Root Directory 已修**（2026-08-20 設 `web`），否則 `git push` 會把 production 搞 404。
- ⚠️ LINE `CHANNEL_ACCESS_TOKEN` **不要按 Reissue**（按了 token 失效要手動更新）。
- ⚠️ 工作站 dashboard 裡 stringing 還寫「待開發」、booking 寫「6 場地」——**已過時**，實況以本知識庫為準。

## 相關

- [[12-穿線服務]]
- [[15-營運維護]]
- [[09-算帳與估價]]
