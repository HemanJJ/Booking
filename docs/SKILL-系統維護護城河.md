---
name: ops-moat
description: 新專案（Next.js/Vercel/Neon/LINE）上線後的「維運護城河」九件套清單與做法。當接手或建立新專案、要做部署/監控/備份/災難復原/角色權限時使用。
metadata:
  author: difly
  version: "1.0"
---

# 系統建立與維護護城河（ops-moat）

> 目標：讓「非工程師老闆」也能 **改程式→部署→知道掛了→掛了能人工營運→資料不丟**。
> 適用：任何 Next.js + Vercel + Neon + LINE 的專案（球場/租拍/穿線…）。

## 一句話原則

系統 = **雲端 + 資料庫 + (選配) 現場硬體**。護城河 = 讓每一層「掛了會知道、壞了能復原、資料不丟」。

---

## 護城河九件套（照順序打勾）

### 1. 一鍵部署（deploy.sh + 長期 token）
- **為什麼**：`vercel login` 短期 token 會過期 → 老是「Not authorized」。
- **做**：
  1. https://vercel.com/account/tokens → Create Token → 到期「No Expiration」。
  2. 存到專案根目錄 `.vercel-token`（`.gitignore` 加 `.vercel-token`，chmod 600）。
  3. 寫 `deploy.sh`：`vercel --prod --token="$(cat .vercel-token)"`。
- **驗證**：`./deploy.sh` 能成功上線。

### 2. 健康檢查（/api/health 測 DB，不是只回 ok）
- **為什麼**：網站「開著」≠「資料庫活著」。要真的 `SELECT 1`。
- **做**：`GET /api/health` → try { 查 DB } → 200 `{ok:true}`，catch → 500。
- **驗證**：手動打 `/api/health`，正常 200、把 DB 網址改錯應 500。

### 3. 監控告警（UptimeRobot 免費）
- **為什麼**：老闆不可能一直盯螢幕。
- **做**：uptimerobot.com → Add Monitor → HTTP(s) → URL 填 **`/api/health`**（不是首頁）→ 5 分鐘 → Email。
- **注意**：北美節點＋冷啟動會「誤報 down」。判真掛：開瀏覽器打不開才算數。

### 4. 時區（固定 Asia/Taipei）
- **為什麼**：Vercel 伺服器跑 **UTC**，台灣凌晨 0–8 點「今天」會錯一天（日期/星期/逾時全歪）。
- **做**：日期統一用 `Intl.DateTimeFormat` 指定 `timeZone: "Asia/Taipei"`，或 `Date.UTC(...) - 8h`。別用裸 `new Date().getDate()`。
- **驗證**：UTC 昨天 17:00（=台灣今天 01:00）要回「今天」。

### 5. 角色分層（member / staff / admin）
- **為什麼**：員工拿到老闆密碼 = 能改價、看營收、停權會員。
- **做**：`role` 欄位三值；後台 `requireStaff()`（進後台）＋ `requireOwner()`（敏感頁：報表/價位/會員/異動）。頁面＋server action **雙層鎖**。
- **原則**：員工=做單收錢；館長=定價＋看帳＋管人。

### 6. 備份（三層，最便宜）
- **為什麼**：資料沒了 = 生意沒了。
- **做**：
  1. **程式碼** → GitHub（改完 `git add -A && commit && push`）。
  2. **資料庫** → Neon 內建 PITR＋每日快照（自動，免設定）。
  3. **手動** → 每週 Neon console → Export 一份 SQL 存雲端硬碟。

### 7. 災難復原（紙本/Excel + 批次匯入）
- **為什麼**：系統全掛也不能停業。
- **做**：
  1. 提供 CSV 範本（欄位：日期/場地/時段/姓名/電話/已收現金）。
  2. 後台做「批次匯入」頁：貼 CSV → 自動算價＋防重疊＋**允許補登過去時段**＋跳過衝突並列原因。
- **閉環**：網站掛 → Excel 接單 → 網站好 → 貼 CSV 批傳回。

### 8. 資料庫地雷（共用庫絕不 db push）
- **為什麼**：多專案共用同一個 Neon，`prisma db push` 會 **drop 掉別人的表**。
- **做**：改 schema → 本地 `prisma migrate dev`；生產用 `Pool` 跑「只 ADD COLUMN / CREATE TABLE」的 ALTER。**永遠不 `--accept-data-loss`**。

### 9. 文件（3 份就夠，別多）
- **為什麼**：vibe coding 最怕文件一堆沒人更新。
- **做**：
  1. `README.md`（是什麼、怎麼跑、怎麼部署）。
  2. `docs/HANDOFF.md`（進度、待辦、地雷、接手指引）。
  3. `docs/obsidian/XX-營運維護.md`（部署/角色/故障速查/每日例行）。

### 10. 子目錄專案：Git push 別搞掛 production（重要地雷）
- **為什麼**：Next.js 程式若放在 repo 的**子目錄**（如 `web/`），Vercel 的 Git 自動部署若「Root Directory」沒設對，會從 repo **根目錄** build → 部署出空殼，**全站 404**。
- **症狀**：`git push` 後 production 首頁/API 全 404。
- **做**：
  1. Vercel → 專案 → Settings → General → **Root Directory** 設成正確子目錄（如 `web`）。
  2. 或關掉 Git 自動部署，只用 `./deploy.sh`（CLI 部署從正確目錄）。
  3. **每次 push 後立刻驗證**首頁＋`/api/health`，別假設成功。
- **急救**：發現 404 → 立刻 `./deploy.sh` 恢復。
- **注意**：root 就在 repo 根目錄的專案（如 booking）不受影響，只有「子目錄」專案會中。

---

## 故障定位 SOP（3 層問法）

```
客人 → Vercel 網站 → Neon 資料庫  (+ LINE 平台，用到才查)
```

| 步 | 做 | 判讀 |
|----|----|------|
| ① | 開網站首頁 | 打不開 → Vercel（查 vercelstatus.com） |
| ② | 開 `/api/health` | 500 → Neon 掛；200 → DB 好 |
| ③ | 哪邊壞（前台/後台/LINE） | 對照速查表 |

- **線上壞、本地好** → 部署/環境變數問題（多半忘了 deploy 或漏設 env）。
- **本地也壞** → 程式 bug → 貼錯誤給 AI。

---

## 交接檢查表（給下一個 project / session）

- [ ] deploy.sh＋token 能一鍵部署
- [ ] /api/health 測得到 DB
- [ ] UptimeRobot 已接 `/api/health`
- [ ] 時區已固定 Asia/Taipei
- [ ] 角色分層＋敏感頁雙層鎖
- [ ] GitHub push 成功、`.env`/`.vercel-token` 已 gitignore
- [ ] CSV 人工接單範本＋批次匯入頁
- [ ] README＋HANDOFF＋維運速查 3 份文件
- [ ] 老闆會做的事：改程式 `./deploy.sh`、收 down 信先開網站確認

---

## 常用指令速查

```bash
./deploy.sh                                  # 一鍵部署（免 login）
curl -I https://你的網域/api/health          # 查 DB 死活
git add -A && git commit -m "..." && git push # 異地備份程式碼
npx prisma migrate dev --name 名字            # 改 schema 後（本地）
```
