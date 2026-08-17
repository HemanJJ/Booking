# DiFly 球場預約系統（重建版 MVP）

依公開網站 https://difly.pos-gpt.com/ 的功能盤點，重新開發的複合式運動場館系統。
本版為 **MVP**：前台核心（首頁 / 場館列表 / 場地詳情）＋ 會員系統（Email/密碼 + LINE Login）＋ 訂位流程（含資料庫層級防重疊訂位）。金流未接，課程 / 教練 / 商城 / 最新消息模組已在資料模型中預留，留待後續擴充。

## 技術棧

- **Next.js 16**（App Router + TypeScript + Turbopack）
- **Tailwind CSS v4**
- **Prisma 7**（`prisma-client` generator + Query Compiler）
- **SQLite**（本地開發，driver adapter：`@prisma/adapter-better-sqlite3` + `better-sqlite3`；Schema 已避開 SQLite 不支援的 enum / scalar list / Json / Decimal，可無痛切換 PostgreSQL）
- **jose**（JWT session + LINE id_token 驗證）
- **bcryptjs**（密碼雜湊）

## 快速開始

```bash
npm install

# 1. 設定環境變數（複製範本後修改）
cp .env.example .env

# 2. 建立資料庫結構
npx prisma migrate dev --name init

# 3. 產生 Prisma Client（v7 不會自動 generate）
npx prisma generate

# 4. 灌入種子資料（6 個場地 + 示範會員）
npx prisma db seed

# 5. 啟動開發伺服器
npm run dev
```

開啟 http://localhost:3000

### 示範帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 一般會員 | `demo@difly.tw` | `demo1234` |
| 管理員（後台） | `admin@difly.tw` | `admin1234` |

## LINE Login 設定

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立 **LINE Login** channel。
2. 在 channel 後台設定 **Callback URL** 為：`http://localhost:3000/api/auth/line/callback`（正式環境換成你的網域）。
3. 把 channel 的資料填入 `.env`：

```env
LINE_CHANNEL_ID="你的 Channel ID"
LINE_CHANNEL_SECRET="你的 Channel Secret"
LINE_CALLBACK_URL="http://localhost:3000/api/auth/line/callback"
```

未設定時，點「使用 LINE 登入」會導回登入頁並提示「LINE Login 尚未設定」。

> 備註：目前 LINE 首次登入會**自動建立**新會員（以 `lineUserId` 對應）。若之後要支援「LINE 帳號與既有 Email 帳號綁定」，需再實作帳號連結流程。

## 核心設計：防重疊訂位（資料庫層級）

- 以「30 分鐘」為最小預約單位，每筆訂位佔用多個 30 分鐘的 `BookingSlot`（30 分＝時價一半，最長 4 小時）。
- `BookingSlot` 的 `@@unique([courtId, date, startTime])` 在**資料庫層級**保證同一場地、同一天、同一時段不可能被重複預訂——即使同時有多筆請求競爭，其中一筆也會因唯一鍵違反（P2002）而整筆交易回滾。
- 取消訂位時一併刪除對應的 `BookingSlot`，釋放時段。

可用 `npx tsx scripts/smoke.ts` 跑一次防重疊訂位的驗證（建立 → 重複預約被拒 → 取消 → 時段釋放）。

## 價位規則（尖峰 / 離峰 + 特定日期）

以「30 分鐘」為計價單位，跨時段自動分段算價。定價優先序：

1. **特定日期**（`kind=date`）：國定假日 / 颱風假等，整日單一價。
2. **固定週規則**（`kind=weekly`）：每週幾＋時段 → 價格（如平日 18:00-24:00 尖峰 400、00:00-18:00 離峰 300、週末全天尖峰）。
3. **場地時價**：無規則時回退到 `Court.pricePerHour`。

後台「價位規則」可新增/編輯/啟停/刪除，支援任意多種價位（尖峰 400、離峰 300、未來想加的「預留」等都可）。颱風假宣布時，新增一筆「特定日期」規則即可整日調價。

**第二層：時長折扣**（`DurationDiscount`）——時段價算完後，再套「滿 N 分鐘折 X 元」，可指定「僅限某時價」（如僅尖峰 400）。例：尖峰 2 小時 800 − 滿 2 小時折 100 ＝ **700**。後台「時長折扣」管理。

## 資料模型

完整藍圖見 `prisma/schema.prisma`：

- **本版已實作**：`Venue`（場館）、`Member`、`Court`、`CourtImage`、`CourtFacility`、`PriceRule`（價位規則）、`DurationDiscount`（時長折扣）、`Booking`、`BookingSlot`
- **已建模、待實作**：`Course` / `CourseEnrollment`（課程）、`Coach`（教練）、`News`（最新消息）、`ProductCategory` / `Product`（商城）、`Order` / `OrderItem`（訂單，金流未接）

> 資料結構：`Venue`（場館，如「迪飛太平」，含 24h 營業時間）→ `Court`（場館內每一「面」場，如 1 號場）→ `Booking`（訂位）。

## 目錄結構

```
prisma/
  schema.prisma          # 資料模型藍圖（本地 SQLite）
  schema.postgres.prisma # 資料模型藍圖（生產 PostgreSQL，與上面同步）
  seed.ts                # 種子資料
vercel.json              # Vercel 建置指令
src/
  app/
    page.tsx          # 首頁
    courts/           # 場館列表、場地詳情
    schedule/         # 查閱場地（未來 7 日週表，訪客/會員查看占用）
    bookings/         # 訂位建立、我的訂位、成功頁
    account/          # 登入、註冊
    admin/            # 管理後台（儀表板/場館/場地/訂位/會員）
    api/              # LINE OAuth、時段查詢、週表查詢
    actions.ts        # Server Actions（註冊/登入/登出/訂位/取消）
  components/         # Header、Footer、表單、相簿…等
  lib/
    prisma.ts         # Prisma client（driver adapter）
    auth.ts           # JWT session + 密碼
    line.ts           # LINE OAuth 2.1 / OIDC
    booking.ts        # 時段邏輯 + 防重疊訂位
    utils.ts          # 日期/金額工具
  generated/prisma/   # Prisma 產生的 client（勿手動編輯，已 gitignore）
```

## 常用指令

```bash
npm run dev            # 開發伺服器
npm run build          # 生產建置
npm run start          # 啟動生產伺服器
npm run lint           # ESLint（Next 16 已移除 next lint）
npx prisma studio      # 資料庫 GUI
npx prisma db seed     # 重新灌種子資料
npx tsx scripts/smoke.ts   # 防重疊訂位驗證
```

## 部署到 Vercel + Neon（生產）

程式已內建「依 `DATABASE_URL` 自動切換」：`file:` 開頭走 SQLite（本地），`postgres` 開頭走 Neon driver adapter。部署步驟：

1. **申請 Neon 資料庫**：到 [Neon](https://neon.tech) 註冊 → 建立專案 → 複製 **Pooled connection string**（形如 `postgresql://…-pooler…neon.tech/…`）。
2. **同步資料表＋種子**：把連線字串貼到本地 `.env` 的 `DATABASE_URL` 後執行：
   ```bash
   npm run db:push      # 建立資料表（首次部署用 db push 即可）
   npx prisma db seed   # 建立場館/場地/管理員
   ```
3. **申請 Vercel**：到 [Vercel](https://vercel.com) 用 GitHub 登入 → Import 這個 repo。
4. **設定環境變數**（Vercel 專案 → Settings → Environment Variables）：

   | 變數 | 值 |
   |------|-----|
   | `DATABASE_URL` | Neon 的 Pooled connection string |
   | `SESSION_SECRET` | 長隨機字串 |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 後台帳號（請設強密碼） |
   | `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | LINE 憑證 |
   | `LINE_CALLBACK_URL` | `https://你的網域/api/auth/line/callback` |
   | `NEXT_PUBLIC_APP_URL` | 你的正式網址 |

5. **部署**：Vercel 會跑 `npm run build`（已含 `prisma generate && next build`，見 `vercel.json`）。
6. **LINE Callback**：到 LINE Developers 後台把 Callback URL 改成正式網址。

> 修改資料模型時，請**同步更新** `prisma/schema.prisma` 與 `prisma/schema.postgres.prisma`（兩者只有 datasource provider 不同）。

## 管理後台

登入管理員帳號後，右上角會出現「管理後台」，或直接到 `/admin`。包含：

- **儀表板**：場館/場地/訂位/會員統計 + 最新訂位
- **場館管理**：場館新增/編輯/啟停（名稱、地址、電話、24h 營業時間）
- **場地管理**：場地新增/編輯/啟停（所屬場館、名稱、時價）
- **價位規則**：尖峰/離峰固定週規則＋特定日期（國定假日/颱風假）整日價
- **時長折扣**：滿 N 分鐘折 X 元，可指定僅限某時價（如僅尖峰）
- **訂位管理**：週表（未來 7 日色塊總覽）+ 訂位列表 + 取消
- **會員管理**：會員列表 + 設為/取消管理員

## 下一步（未完成項目）

1. **金流**：目前無金流，訂位直接「已確認」。接金流時需加入付款狀態機 + 綠界/藍新等串接。
2. **課程 / 教練 / 商城 / 最新消息**：模型已備好，補前台頁面 + 對應後台即可。
3. **LINE 帳號綁定**：LINE 首次登入與既有 Email 帳號合併的流程。
4. **時區**：目前以伺服器本地時間判斷「已過去的時段」，正式部署（尤其台灣 UTC+8）應明確固定時區。
