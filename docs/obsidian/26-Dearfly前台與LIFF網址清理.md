---
tags: [difly, 前台, 訂位, LIFF, cache, 網址, 2頁化, 上線, 反省]
created: 2026-08-30
---

# Dearfly 前台上線 + LIFF 網址清理（前端大改 + 快取/LIFF 修正）

> 2026-08-30 一大波前台改動，從「打樣」到「正式上線」，並徹底清理 vercel 舊網址。本篇歸檔成果與踩坑。

---

## 一、前台訂位「2 頁化」改版（已上正式）

### 舊流程（3 頁，要繞）
```
首頁 → 場地列表(/courts) → 場地詳情(/courts/[id]) → 建立訂位(/bookings/create)
```

### 新流程（2 頁，直接）
```
首頁「現在訂場/線上訂場/精選場地卡」 → 建立訂位(/bookings/create)  ← 1 步
Header「場館預約/立即預約」 → 建立訂位
「查閱場地」保留（看空檔用）
```
- **場地列表/詳情** 不再主流程必經（保留為瀏覽用）
- **LIFF 登入後** → 直接進 `/bookings/create`（不再場地列表）

### 訂位頁改版（中和配色 + 兩層結構）
| 區塊 | 設計 |
|------|------|
| 選擇分店 | 下拉（太平/中興/大里）|
| 選擇場地 | 白底黑字「1號場」一列 4 格 + hover 亮綠，active 翠綠 |
| 選擇日期 | 下拉展開**月曆**（可切換月份、過去日期變灰）|
| 選擇開始時段 | **可訂=亮綠、不可訂=粉紅「滿場」**、價格上格（NT$300/NT$400）|
| 底部 fixed bar | **固定在視窗底部**：分店·場地｜日期｜時段（診斷+提醒客人）|
| 試算卡 | 顯示場地 + 價格 + 折扣 |

---

## 二、LIFF / 網址清理（把 vercel 拿掉）

### 改動
| 層 | 舊 | 新 |
|----|----|----|
| Vercel env `LINE_CALLBACK_URL` | 舊/本機 | `https://dearfly.com.tw/api/auth/line/callback` |
| Vercel env `NEXT_PUBLIC_APP_URL` | 舊 | `https://dearfly.com.tw` |
| 球場 LIFF Endpoint（`-e5z12ax6`）| vercel/錯 | `https://dearfly.com.tw/liff`（LINE Developers 手改）|
| 穿線 LIFF Endpoint（`-EAehh2nJ`）| smartlocker-alpha | `https://shop.dearfly.com.tw/liff`（LINE Developers 手改）|
| Rich Menu「我的訂位」 | `difly-booking.vercel.app/bookings` | `https://dearfly.com.tw/bookings` |
| Rich Menu「預訂場地」 | `liff.line.me/1660947211-e5z12ax6` | ✅ 正確（Endpoint→dearfly.com.tw/liff）|

> ⚠️ **LIFF Endpoint 在 LINE Developers Console 手改**，不是程式碼。工程師無法代登入，需老闆/業者在 developers.line.biz 登入後改。

---

## 三、Cache（可訂狀態不同步）根源

### 症狀
「明明已訂，建立訂位卻顯示可訂（綠）」「同一天但兩張圖顯示不同」（其實不同面場）。

### 根因
`/api/bookings/available` 與 `/api/bookings/week` 原本 `Cache-Control: public, max-age=0`，
手機 /**LINE LIFF WebView** 緩存舊回應 → 切場地/日期顯示過時「可訂」。

### 修法（雙保險）
1. **Server 端**：兩支 API 改 `Cache-Control: no-store, max-age=0`
2. **前端 fetch**：BookingForm / WeekSchedule 的 fetch 加 `cache: "no-store"`

> 通用原則：**訂位/庫存/餘額/可訂時效敏感 API → 一律 no-store**；LINE LIFF 對這類特別易緩存。

---

## 四、Rich Menu 重建（生圖 + 對齊按鈕）

- 生圖：Chrome headless 截 2500×1686（Dearfly 六格），已 set-default
- 按鈕對齊：查詢訂單/預訂場地/價目表/我的訂位/用品商城/聯絡客服（2 直欄×3 橫列）

---

## 五、Header 導覽「方型」修正

- 手機窄屏被壓成「一字一行直排」→ 加 `whitespace-nowrap` + `shrink-0` + `overflow-x-auto` + `ml-auto`
- admin 多按鈕不再第一個被壓成單字「地」

---

## 六、踩坑反省（同 [[25-求真方法與快取坑]]）

- **先信使用者畫面**，別拿 API 反駁「你看錯場」。
- **查 UI 同步**：先重現畫面（pilot/瀏覽器），再查前端/快取，最後才查 DB。
- 我這次**又先下錯誤斷言再收回**（查 `pg_constraint` 說「沒防重疊」，實際是 UNIQUE INDEX 在 `pg_indexes`）——**方法不嚴謹**，已記取。

---

## 相關

- [[25-求真方法與快取坑]]
- [[20-CrossCheck兩系統]]
- [[15-營運維護]]
- [[21-營運晴雨表]]
