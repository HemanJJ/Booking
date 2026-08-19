# 專案交接文件（HANDOFF）— 程式開發

> 接手者請先讀這份。三個專案、進度、待辦、怎麼繼續，都在這。

---

## 一、三個專案（位置）

| 專案 | 路徑 | GitHub | 線上網址 |
|------|------|--------|---------|
| 球場預約 | `/Users/defi/Desktop/projects/code/booking` | `HemanJJ/Booking` | https://difly-booking.vercel.app |
| 租拍（5 家） | `/Users/defi/Desktop/projects/code/smartlocker` | `HemanJJ/smartlocker` | https://smartlocker-alpha.vercel.app |
| 穿線服務 | `/Users/defi/Desktop/projects/code/stringing` | `HemanJJ/stringing` | 尚未開發 |

---

## 二、技術棧（三專案一致）

- **Next.js 16**（App Router + TypeScript + Turbopack）
- **Tailwind CSS v4**
- **Prisma 7**（球場系統；租拍/穿線用 raw SQL via `@neondatabase/serverless`）
- **資料庫**：本地 SQLite／生產 Neon PostgreSQL
- **LINE**：LINE Login（OAuth/LIFF）＋ Messaging API（通知）
- **部署**：Vercel（CLI `vercel --prod`）＋ Neon

---

## 三、目前進度

### 球場預約（booking）✅ 已上線、可營業
- 前台：首頁、場館/場地、訂位、查閱場地（週表）、我的訂位、修改密碼
- 會員：Email/密碼 + LINE 登入（含 LIFF）
- 訂位：30 分鐘單位、**資料庫層級防重疊**、取消
- 價位：尖峰/離峰＋國定假日＋時長折扣
- 後台：儀表板、報表、場館、場地、價位規則、時長折扣、訂位、會員
- LINE：訂位/取消通知店家

### 租拍（smartlocker）✅ 已上線
- 5 家分店、取件碼、LINE 客服、分店營收報表（`/admin`）

### 穿線服務（stringing）⏳ 規格定稿、待開發
- 完整規格：`stringing/HANDOFF.md`

---

## 四、下一個任務：LINE Pay 金流（球場系統）

**背景**：使用者已決定走 **LINE Pay**（線上）＋雷門 POS（實體，獨立）。有公司行號，準備申請 LINE Pay 商家。

**要做的事**：
1. 申請 LINE Pay 商家 → 拿到 `LINE_PAY_CHANNEL_ID` + `LINE_PAY_CHANNEL_SECRET`。
2. 串 LINE Pay v3 web 付款。
3. 流程：訂位 → 待付款（先佔時段）→ 跳 LINE Pay → 付款成功 →「已確認」；未付款逾時自動釋放時段。

**相關的業務規則**（已定稿，見 `docs/obsidian/13-營業規則.md`）：
- 24h 前取消全退；24h 內取消收 10%；no-show 不退；3 次 no-show 永久停權（後台人工解鎖）。

---

## 五、環境變數 / 帳號位置

- 金鑰一律存 `.env`（本地）與 Vercel 環境變數（`vercel env ls` 可看名稱，值會遮罩）。
- 後台帳號：`admin@difly.tw`（密碼在 Vercel `ADMIN_PASSWORD`）。
- LINE Login channel：`1660947211`；LIFF：`1660947211-e5z12ax6`。
- 詳細金鑰清單與 rotate：見 `docs/obsidian/10-資安與金鑰.md`。

---

## 六、常用指令（球場系統）

```bash
cd /Users/defi/Desktop/projects/code/booking
npm run dev                # 本地開發（SQLite）
npm run build              # prisma generate + next build
npx prisma db seed         # 重灌種子資料
npx prisma migrate dev     # 改 schema 後
vercel --prod              # 部署（需已 vercel login）
```

> 改 `prisma/schema.prisma` 時，`prisma/schema.postgres.prisma` 要**同步**改。

---

## 七、給新 session 的接手指引

```
讀 /Users/defi/Desktop/projects/code/booking/docs/HANDOFF-程式交接.md
以及 docs/obsidian/ 知識庫、stringing/HANDOFF.md。
目前任務：接 LINE Pay 金流（球場系統）。
```

---

## 八、文件位置

- Obsidian 知識庫（13 篇）：`booking/docs/obsidian/`
- 對話備份：`booking/docs/開發紀錄-對話備份.md`
- 合約書草稿：`booking/docs/合約書草稿.md`
- 合夥人簡報：`booking/docs/defi系統進度簡報.md`
