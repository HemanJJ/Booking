---
tags: [difly, 羽球離峰, EasyCourt, 套票, 金流, MOC]
created: 2026-08-27
---

# 羽球離峰整合平台 EasyCourt（套票系統）

> **輕資產平台**：不擁有場地，只做「離峰庫存 + 線上即時預約 + 金流 + 自動核帳」。
> 從 booking（球場預約）系統擴充出來，第一塊落地的是「做法二：球隊團練包」套票。

## 一句話定位

- **供給側（場館）**：要曝光 + 自動核帳系統。
- **需求側（球友）**：一站比價、線上付款、免打電話。
- **平台**：抽成撮合（不擁有資產），對標 easycamp.com.tw 的營區雙邊市場模式。

## 商業模式關鍵決策

| 決策 | 內容 |
|------|------|
| 抽成 | 10–15% 是「**總部對球館的總抽成**」（含系統＋夥伴）；球館只看單一數字，夥伴分潤從這筆內部分、**不疊加** |
| 套票結算價 | 用「**套票折讓價**」，不是原離峰價，否則平台倒虧 |
| MVP | 做法二「綁館球隊團練包」（10 次 × 2 小時）；跨館通券月票（做法一）放第二階段 |
| 離峰價 | 約 NT$300/時（現行 booking 離峰價） |
| 教練招牌 | `coachName` + `source: coach`，教練帶隊/銷售是分銷管道 |

## 套票資料模型（新增兩張表）

- **Package**：套票本身。持有人、綁館/綁場（`venueId`/`courtId` 可空＝跨館通券）、綁星期/時段、總/剩餘單位、`unitPrice`、`price`、`commissionRate`、效期、狀態（active/exhausted/expired/refunded）。
- **PackageUsage**：每一筆核銷。關聯訂位、本次單位、`grossAmount`、`commission`、`venueShare`、`settled`。

計量 = `totalUnits × unitMinutes`（sessions 每單位 120 分；hours 每單位 30/60 分）；金額一律**整數 NT$**。

## 核銷 + 自動核帳的核心規則

1. **核銷** = 建立一筆 `Booking`（沿用 `BookingSlot @@unique` 防重疊，資料庫層級互斥）＋ 扣套票單位 ＋ 記一筆 `PackageUsage`，同一交易完成。
2. **金額拆分**：`gross = 單位 × unitPrice`（除不盡的尾數歸最後一次核銷）；`commission = round(gross × rate%)`；`venueShare = gross − commission`。
3. **對帳**：每筆 `PackageUsage` 記 `settled`；`settleVenue()` 把某館「未結算」批次標記為已結算，球館後台對帳單 = `Σ venueShare`。
4. 驗證：綁定星期/時段窗、持有人、效期、剩餘單位，全在 `package-core.ts` 純函式（無 DB）。

## 程式位置（booking-demo）

| 檔案 | 用途 |
|------|------|
| `src/lib/package-core.ts` | 純邏輯（驗證/換算/金額拆分/對帳彙總，無 DB 依賴） |
| `src/lib/package.ts` | Prisma 版（purchase / redeem / settleVenue / refund / 對帳單） |
| `src/app/admin/package-actions.ts` | server actions（建立/核銷/結算/退票） |
| `src/app/admin/packages/` | 三個頁面：列表、核銷、對帳結算 |
| `src/components/admin/PackageForm.tsx`、`RedeemPackageForm.tsx` | 表單元件 |
| `prisma/schema.prisma` + `schema.postgres.prisma` | 新增 `Package`/`PackageUsage`（兩份同步） |

## 使用流程（後台）

1. 後台「套票管理」→「＋新增套票」：選會員、名稱、總單位、每單位分、售價、抽成、綁場館/場地/星期/時段。
2. 「核銷」：選套票＋場地＋日期＋時間＋時長 → 建立訂位、扣單位、自動記帳。
3. 「套票對帳」：選場館看未結算明細＋球館實收總額 → 按「結算」撥款。

實測範例：團練包 $2,700/10 次 → 核銷 1 次（2 小時）＝毛 $270 → 平台 $41、球館 $229。

## 上線待辦

- [ ] 線上 Neon 資料庫加 `Package`/`PackageUsage`（migration / db push）
- [ ] Vercel 部署 booking-demo → `booking-demo.dearfly.com.tw`
- [ ] 正式金流（綠界/藍新/Line Pay 平台收款）
- [ ] 跨館通券月票（做法一；`venueId = null` 已預留）
- [ ] 套票到期 `active → expired` 的 cron（比照 `releaseExpiredBookings` 惰性清理）

## 相關

- [[01-專案總覽]]
- [[04-訂位與防重疊]]
- [[05-價位規則]]
- [[13-營業規則]]
