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
- 訂位：30 分鐘單位、**資料庫層級防重疊**、取消、24h 保留自動釋放
- 價位：尖峰/離峰＋國定假日＋時長折扣
- 後台：**今日總覽卡＋時間軸**、代客下單/改單、**排班拖移**、**固定訂位（每週固定團）**、收款標記（未收/現金/LINE Pay/點數）、**異動紀錄 logfile**、報表、場館、場地、價位規則、時長折扣、訂位、會員
- **角色分層**：member / staff（櫃台）/ admin（館長）
- LINE：訂位/取消通知店家、Rich Menu 6 格
- **時區已固定 Asia/Taipei**（`lib/utils.ts`）
- LINE Pay v3 骨架已就緒（`/api/linepay/*`），等商家憑證開通

### 租拍（smartlocker）✅ 已上線
- 5 家分店、取件碼、LINE 客服、分店營收報表（`/admin`）

### 穿線服務（stringing）⏳ 規格定稿、待開發
- 完整規格：`stringing/HANDOFF.md`

---

## 四、下一個任務

### A. no-show / 營業規則自動化 ✅ 已完成（2026-08-22）

營業規則 13：24h 內取消收 10%、no-show 不退、**3 次 no-show 永久停權**。
- ✅ 訂位加 `attendance`（pending/arrived/noshow）＋ `attendanceAt`；會員加 `noShowCount`。
- ✅ 後台訂位列表可標「已到場 / 未到 / 清除」；會員管理顯示未到次數；解鎖時計數歸零。
- ✅ cron `/api/cron/release` 併入 `autoMarkNoShows()`：訂位結束＋6h 寬限期仍未標到場 → 自動判 no-show、累計、達 3 次自動停權＋LINE 通知店家。
- ✅ 停權會員前台與代客下單皆擋。
- 實作：`src/lib/noshow.ts`；驗證：`scripts/smoke-noshow.ts`（本地）。
- ⚠️ 部署需先對 Neon 手動 `ALTER TABLE ... ADD COLUMN`（attendance/attendanceAt/noShowCount），再 `./deploy.sh`。

### B. LINE Pay 金流（等商家憑證）

**背景**：已決定走 **LINE Pay**（線上）＋雷門 POS（實體，獨立）。有公司行號，準備申請 LINE Pay 商家。

**要做的事**（骨架已就緒，只差憑證＋實測）：
1. 申請 LINE Pay 商家 → 拿到 `LINE_PAY_CHANNEL_ID` + `LINE_PAY_CHANNEL_SECRET`。
2. 填入 Vercel 環境變數即可開通（程式已寫好 `/api/linepay/*`）。
3. 流程已定：訂位 → 待付款（先佔時段）→ 跳 LINE Pay → 付款成功 →「已確認」；未付款逾時自動釋放。

### C. 前台「查閱場地」點選訂位（P2，拉低門檻）

客人點空時段 → 直接引導登入下單。

### D. 排班拖移強化 ✅ 已完成（2026-08-22）

- ✅ **修舊瀏覽器相容**：ScheduleBoard 原本全用 Pointer Events（Safari<13/舊 Edge/IE 不支援 → 點一下、拖移全失效）。改為 `supportsPointer` 偵測：支援走 pointer、不支援自動退回 mouse events。
- ✅ **拖右緣＝調時長**：色塊右緣加把手，橫拖 30 分為單位（30~240，防重疊＋營業時間檢查），`adminResizeBookingAction`。
- ✅ **點空白時段＝頁內代客下單**：QuickCreateModal（選會員/臨時客人＋時長＋收款），預填場地/日期/時段，送出後 `returnTo=/admin/schedule` 留在原頁。
- ✅ **時長調整允許過去訂位**（`updateBooking` 加 `allowPast`），錯誤不再靜默吞掉（throw 讓 modal 顯示原因）。
- 檔案：`src/components/admin/ScheduleBoard.tsx`（改）、`QuickCreateModal.tsx`（新）、`src/app/admin/actions.ts`、`src/lib/booking.ts`。

---

## 五、環境變數 / 帳號位置

- 金鑰一律存 `.env`（本地）與 Vercel 環境變數（`vercel env ls` 可看名稱，值會遮罩；Sensitive 的抓不到真值）。
- **部署 token**：存於專案根目錄 `.vercel-token`（gitignore），部署用 `./deploy.sh`。
- 後台帳號：`admin@difly.tw`（密碼在 Vercel `ADMIN_PASSWORD`）。
- LINE Login channel：`1660947211`；LIFF（預訂場地）：`1660947211-e5z12ax6`。
- LINE Pay（待申請）：`LINE_PAY_CHANNEL_ID` / `LINE_PAY_CHANNEL_SECRET`。
- Cron 保護：`CRON_SECRET`。
- 詳細金鑰清單與 rotate：見 `docs/obsidian/10-資安與金鑰.md`。

---

## 六、常用指令（球場系統）

```bash
cd /Users/defi/Desktop/projects/code/booking
./deploy.sh                # 一鍵部署（讀 .vercel-token，免登入）
npm run dev                # 本地開發（SQLite）
npm run build              # prisma generate + next build
npx prisma db seed         # 重灌種子資料
npx prisma migrate dev     # 改 schema 後（本地）
npx tsx scripts/richmenu.ts list   # 看 LINE 圖文選單
```

> 改 `prisma/schema.prisma` 時，`prisma/schema.postgres.prisma` 要**同步**改。
> ⚠️ **不要 `prisma db push`**：Neon 與租拍/穿線共用，db push 會 drop 它們的表（見 `docs/obsidian/15-營運維護.md`）。

---

## 七、給新 session 的接手指引

```
讀 /Users/defi/Desktop/projects/code/booking/docs/HANDOFF-程式交接.md
以及 docs/obsidian/ 知識庫（重點：15-營運維護、14-UIUX、13-營業規則）、stringing/HANDOFF.md。
目前任務：no-show 停權自動化已完成（A）；下一個是前台點選訂位（C）；LINE Pay 等商家憑證。
```

---

## 八、文件位置

- Obsidian 知識庫（15 篇）：`booking/docs/obsidian/`
- 對話備份：`booking/docs/開發紀錄-對話備份.md`
- 合約書草稿：`booking/docs/合約書草稿.md`
- 合夥人簡報：`booking/docs/defi系統進度簡報.md`
