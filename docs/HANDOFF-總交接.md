# 總交接（HANDOFF）— DiFly 三合一服務

> 接手者先讀 `無人場館管理-總藍圖.md`（整個生意的圖），再讀這份，再讀各專案 docs。本次會話結束於 **2026-08-20**。

---

## 一、三個系統（都在雲端，Mac 只是開發機）

| 系統 | 程式碼 | 資料庫 | 網站 |
|------|--------|--------|------|
| 球場 booking | `code/booking`（GitHub `HemanJJ/Booking`） | Neon（與穿線共用 `neondb`） | https://difly-booking.vercel.app |
| 穿線 smartlocker | `code/smartlocker/web`（GitHub `HemanJJ/smartlocker`） | 同上 | https://smartlocker-alpha.vercel.app |
| 穿線文件 | `code/stringing`（GitHub `HemanJJ/stringing`） | — | — |

- 另：`code/badminton_mkt`（FB 行銷，GitHub `HemanJJ/badminton_mkt`）、`code/_workstation`（本機 dashboard，**無 git**）。

---

## 二、本次會話完成（重點）

### 球場 booking（全部已上線）
- **老闆視角後台**：今日總覽 4 卡＋7 面場時間軸（紅線=現在）
- **代客下單 / 改單**、**收款標記**（未收/現金/LINE Pay/點數）、**24h 保留自動釋放**
- **排班拖移**（`/admin/schedule`，拖色塊改時間/換場，點一下＝快速編輯）
- **固定訂位**（`/admin/recurring`，每週固定團，自動生成未來 4 週）
- **批次匯入**（`/admin/import`，災難復原用，貼 CSV 補登）
- **角色分層**：member / staff（櫃台）/ admin（館長）
- **異動紀錄 logfile**（`/admin/logs`）
- **LINE Pay v3 骨架**（`/api/linepay/*`，等商家憑證）
- **時區已固定 Asia/Taipei**

### 穿線 smartlocker（雲端已上線，硬體待做）
- 雲端閉環完成（下單/後台/列印佇列/LINE 通知）
- **22 格**（已修，非 6）、只留 **df-a 太平**營業（df-b~e 停用）
- **Root Directory 已設 `web`**（修了 git push 搞掛 production 的坑）
- 待做：GoDex 列印對位、RS-485 格口（**硬體，現場另做**）

### 維運護城河（兩個系統都做了）
- 一鍵部署 `./deploy.sh`（booking 根、smartlocker/web）
- 健康檢查 `/api/health`（測 DB）
- UptimeRobot 監控（兩個站都接了）
- 備份：GitHub（碼）＋Neon 自動備份（資料）＋**手動層已建**：`💾 備份Neon資料庫.command`（pg_dump → iCloud「Difly備份」，可每週日自動）
- 災難復原：Excel 接單 → `/admin/import` 批次匯入；**網站復原後先手動跑一次 `/api/cron/release`**（清卡住的 24h 保留＋補固定訂位）

### 本機工具
- **識圖 Qwen2.5-VL**：`_workstation/img2txt-local.py`（看字＋圖意，免錢離線）
- **行銷助手**：`badminton_mkt` 的 OCR 服務加 `/vision`（看字＋圖意＋行銷點子），面板有「看懂圖意」按鈕

---

## 三、下一步（優先序）

| # | 任務 | 狀態 |
|---|------|------|
| 1 | **LINE Pay**：申請商家 → 填 `LINE_PAY_CHANNEL_ID/SECRET` → 開通（booking＋販售共用） | 等憑證 |
| 2 | **穿線硬體**：GoDex 列印對位、RS-485 格口（販售 2 櫃＋未來大櫃同鏈） | 現場另做 |
| 3 | **no-show 停權自動化**（3 次永久停權，目前手動） | 待做 |
| 4 | **前台「查閱場地」點選訂位**（P2） | 待做 |
| 5 | **正式營業前清 demo 資料**（線上現有 20 假會員＋107 假訂位；smartlocker 測試店/測試貨要不要留待定） | 待清 |
| 6 | **販售＋泡麵 24h 無人店**：**Phase 1 已完成**（軟體全上線）——商品/進銷存/量價階梯/配貨/自動補貨/分店切換/LINE 通知/後台認證（見 obsidian 18 篇） | ✅ 完成 |
| 7 | **團購/批發下單（Phase B）**：選量→套階梯→確認單（量價階梯地基已建） | 待做 |
| 8 | **加盟商分店帳號**：每店一組密碼，只看自己店（分店切換器已建） | 待做 |
| 9 | **大櫃硬體**：球拍/球鞋/球袋大件進無人店（規則已記，大櫃做好自動生效） | 待硬體 |

---

## 四、檔案地圖

```
code/
  HANDOFF-總交接.md           ← 這份
  無人場館管理-總藍圖.md       ← 整個生意的圖（三合一＋LINE＋行銷，先讀這份）
  SKILL-系統維護護城河.md      ← 新專案維運 SOP（10 條地雷）
  💾 備份Neon資料庫.command    ← 手動備份（Neon → iCloud，保留 8 份）
  🗓️ 啟用/停用每週自動備份.command ← 每週日 03:30 自動備份（launchd）
  booking/
    docs/HANDOFF-程式交接.md
    docs/obsidian/            ← 知識庫 19 檔（01–18＋首頁索引；15 維運、16 拍櫃、17 災難復原、18 運動商城與進銷存）
    scripts/seed-demo.ts      ← demo 資料產生器
    scripts/reset-admin-password.ts ← 重設 booking 後台密碼（DATABASE_URL＋NEW_ADMIN_PASSWORD）
    deploy.sh                 ← 一鍵部署
  smartlocker/docs/
    規格-販售與泡麵24h.md      ← 販售＋485 級聯＋Phase 1 運作紀錄
    規格-運動商城.md           ← 總倉盤商：量價階梯＋自動補貨流程
  smartlocker/web/
    deploy.sh
    src/lib/stringing.ts      ← 穿線領域層
  _workstation/               ← 本機 dashboard（無 git，含識圖 img2txt-local.py）
  badminton_mkt/fb_helper/    ← 羽球 FB 行銷（OCR + 看懂圖意）
```

---

## 五、地雷（重要）

1. ⚠️ **絕不 `npx prisma db push`**：booking 與穿線共用 Neon，db push 會 drop 穿線的表。
2. ⚠️ **smartlocker Root Directory 要設 `web`**（已設好，別改）。
3. ⚠️ **LINE `CHANNEL_ACCESS_TOKEN` 不要按 Reissue**（按了 token 失效要手動更新）。
4. ⚠️ `_workstation` 裡有 OpenRouter API key，**別 push 到 GitHub**。
5. ⚠️ 穿線是「穿線」不是「租拍」（歷史文件寫「租拍」是筆誤）。
6. ⚠️ **LINE token「別按 Reissue」vs 17 篇教「重新發行」不衝突**：只有金鑰遺失／換新 Mac 才 Reissue；Reissue 後**立刻**把新 token 貼回 Vercel env 並 `./deploy.sh`，否則舊 token 一按即失效、bot 當場斷線。

---

## 六、接手 3 步驟

```bash
# 1. 確認生意活著
open https://difly-booking.vercel.app/api/health   # 球場
open https://smartlocker-alpha.vercel.app/api/health # 穿線

# 2. 要開發 → 拉 repo＋填 .env（金鑰清單見 `booking/docs/obsidian/10-資安與金鑰.md`；去哪拿見 `17-災難復原.md` 第四節）
#    smartlocker 後台密碼已存 DB（admin_credentials）；改密碼：後台 🔑 或 scripts/seed-admin-password.mjs
#    LINE 通知（低庫存/配貨）推給 STAFF_LINE_USER_ID（逗號可多顆）＋STAFF_LINE_USER_IDS

# 3. 部署
cd code/booking && ./deploy.sh
cd code/smartlocker/web && ./deploy.sh
```

---

## 七、LINE Login 概念（本會話釐清，勿再混淆）

- **LINE Login（OAuth）**＝登入認證（會員卡），用 channel `1660947211`，客人**不用加好友**。
- **官方帳號（Messaging）**＝通知/客服（通訊錄），bot `@014uppgb`，客人**加好友才能收通知**。
- 兩者 `userId` 不同；要對上靠「客人傳取件碼綁定」。
- 平台方原則：**登入是我的（平台），粉絲是他的（業者）**。

---

## 八、本會話最後金句

> 生意在雲端，程式在 GitHub，資料在 Neon，Mac 只是工具。掛了看 `17-災難復原.md`。


---

## 九、Session 紀錄（2026-08-22）

### 完成（本 session 追加）
- **運動商城**：量價階梯（%或單價、批次套用）、**配貨到店**（總倉→店家，草稿→人工審核→核准配送＋LINE 通知）、**自動補貨**（安全存量→需求單→配貨草稿→審核）
- **分店模型**：太平總店（id1，總倉）＋測試加盟店（id6，Demo，15 項各 10）；B~E 空殼已停用（真加盟簽約才啟用）
- **王清標 15 項測試資料**（總倉各 90、測試店各 10、789折三階）
- **報價單**：`場館導入服務報價單.md`（台灣台幣、3 方案＋硬體＋月費＋分潤＋KPI）
- **識圖**：本機 macOS 視覺工具（view_image/ocr_image）免費可用；DSH 貼圖識圖（Kimi/OpenRouter）已串好

### DSH 插件環境（2026-08-22 現況）
- 已裝：**dshmarket**（市集入口，npm 乾淨裝）、**dsh-memory**（長期記憶 v0.5.0）、**dsh-plugin-image-input**（貼圖→Kimi 識圖）、**dsh-pilot**（無頭瀏覽器，備而不用）
- 已還原乾淨過一次（教訓：CLI `github:&path:` 語法斷鏈 → **插件一律手動經市集裝**，CLI 只裝 npm 套件）
- 待裝（下 session）：`dsh-kb-sieve`（知識庫打包）、`dsh-data-agent`（AI 查 Neon）——一次一支
- 設定待辦：「知识库回写 未挂载」→ 設定→插件→知識庫寫回資料夾填 `~/Documents/Difly自動筆記`（新資料夾，別指 obsidian 主庫）

### 待辦優先序（不變）
1. LINE Pay 憑證（等商家） 2. 硬體：485/GoDex/kiosk（板子 4 天後到，**先驗板 skb_probe.py sweep**） 3. no-show 自動化 4. 點選訂位 5. 清 demo 6. 團購 Phase B 7. 加盟商帳號 8. 大櫃
