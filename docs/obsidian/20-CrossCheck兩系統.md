---
tags: [difly, 球場預約, 交叉檢查, cross, 共用DB]
created: 2026-08-22
---

# Cross-Check：booking × smartlocker 交叉關係檢查（2026-08-22）

> 目的：確認兩個系統（booking 球場 / smartlocker 穿線販售）在「共用 Neon、
> 共用 LINE、品牌、網址」上的交叉點，避免互相踩雷。這是改動前的必查清單。

## 一、共用 Neon 資料庫（最關鍵）

- 兩系統**共用同一個 Neon `neondb`**：booking 用 Prisma、smartlocker 用 raw SQL。
- 目前 **38 張 public 表，無表名衝突**：
  - booking 用單數：`Booking`、`Member`、`Court`、`Order`、`Product`…
  - smartlocker 用複數：`orders`、`venues`、`inventory`、`locker_slots`…
- ⚠️ **絕不 `prisma db push`**（會 drop smartlocker 的表）。booking `package.json`
  有 `db:push` script 但**從未使用**；改 schema 一律：
  - 本地：`prisma migrate dev`（SQLite）
  - 生產：手動 `ALTER TABLE ... ADD COLUMN`（psql 連 Neon，用 smartlocker/web/.env.local 的 DATABASE_URL）
- ⚠️ 改 booking schema 時 **schema.prisma 與 schema.postgres.prisma 兩份必須同步**（已驗證一致）。

## 二、共用 LINE

- 兩系統用**同一個 LINE bot**：`羽拍有約_太平永成`（@014uppgb）。
- `LINE_CHANNEL_SECRET` 兩邊同值（3a167c3e…），同一 channel OK。
- ⚠️ **別按 Reissue**（token 失效要手動同步 Vercel＋deploy）。
- LINE 每月免費額度 **200 則**，用完等下月重置（`GET /v2/bot/message/quota` 可查）。

## 三、品牌與網址（2026-08-22 已清理）

| 項目 | 現況 |
|---|---|
| 品牌 | 全改 **Dearfly**（booking＋smartlocker＋LINE 通知＋Rich Menu SVG） |
| 球場網域 | **dearfly.com.tw**（Vercel：difly-booking 專案） |
| 穿線/販售網域 | **shop.dearfly.com.tw**（Vercel：smartlocker 專案） |
| 舊網址 | difly-booking.vercel.app / smartlocker-alpha.vercel.app 仍可用（勿刪） |
| 殘留掃描 | ✅ 已清（booking 首頁 features 指向 shop.dearfly.com.tw） |

- ⚠️ **改網域/品牌後要掃殘留**：
  ```bash
  grep -rn "smartlocker-alpha\|difly-booking\|DiFly\|羽拍有約" booking/src smartlocker/web/src
  ```

## 四、環境變數交集

| 變數 | booking | smartlocker | 備註 |
|---|---|---|---|
| DATABASE_URL | 本地 SQLite | Neon | 不同是設計（booking 本機開發用） |
| LINE_CHANNEL_SECRET | 同 | 同 | 同一 channel |
| SESSION_SECRET | 獨立 | 獨立 | OK |

## 五、Vercel 綁定

- booking 專案：dearfly.com.tw（+ difly-booking.vercel.app）
- smartlocker 專案：shop.dearfly.com.tw（+ smartlocker-alpha.vercel.app）
- 各用各的 `.vercel-token`，`./deploy.sh` 一鍵部署。

## 相關

- [[15-營運維護]]（DB 地雷）
- [[19-UI踩坑紀錄]]
