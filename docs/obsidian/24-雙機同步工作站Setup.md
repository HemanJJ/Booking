---
tags: [difly, 雙機, 同步, workstation, dashboard, syncthing, mac, MOC]
created: 2026-09-01
---

# 雙機同步工作站 Setup（home Mac mini ↔ Mac Air）

> 目的：兩台 Mac（家機 + 行動機）做到「感覺是同一台」——**程式碼、Dashboard、Obsidian 知識庫全部互通**。

## 兩台機器

| | home Mac mini | Mac Air |
|---|---|---|
| 主機名 | defideMac-mini.local | HodeMacBook-Air.local |
| 顯示名 | defi的Mac mini | Ho的MacBook Air |
| Tailscale IP | 100.113.154.98 | 100.110.154.103 |
| 使用者 | defi | hohe |
| SSH | 本機 | `ssh -i ~/.ssh/id_ed25519 hohe@100.110.154.103`（免密）|
| 專案根 | `~/Desktop/projects/code` | `~/code`（**與 home 不同**）|
| Obsidian vault | `~/Documents/GitHub/AI-OS-Pro/vault` | `~/code/AI-OS-Pro/vault` 或 `~/Documents/GitHub/AI-OS-Pro/vault` |

> SSH 免密：home 的 key 在 `~/.ssh/id_ed25519`（註解 defimac-mini-pos）。Air 側使用者 `hohe`。**Air 其實有 Homebrew**（`/opt/homebrew/bin/brew`）——只是 SSH 的 PATH 只有 `/usr/bin:/bin:/usr/sbin:/sbin`,所以 `command -v brew` 找不到。

## Dashboard（新版,跨機版本）

- **真正的（活躍）dashboard = `~/Desktop/projects/code/_workstation/dashboard_server.py` + `.html`**——功能最全：**💬 LINE 額度計次、🔑 登入速查、🌐 常用網址、🧠 別忘的關鍵、Codex LLM Router、Claude Router、OpenRouter** 等都在。
- 「**🖥 跨機同步**」已**加**進 _workstation（`/api/machine`、`/api/sync-status`、`/api/parity`、`/api/sync-git` + 路徑解析 + 一鍵同步分頁）——**純加法,原有功能沒刪**（2026-09-04 整合;備份 `dashboard_server.py.bak-integ` / `dashboard.html.bak-integ`）。
- ⚠️ 另有 `~/Desktop/projects/code/dashboard_server.py`（較簡版）＝**不是活躍版,別混用**（之前誤當新版、害原功能看似消失,已改回 _workstation 為基底）。
- **路徑解析**：`resolve_path` 用**掃描（iterdir）**找專案（`ALT_ROOTS` = `~/Desktop/projects/code`、`~/code`、`~/Documents/GitHub`、`~/Booking`）。
  - ⚠️ 千萬別用 `Path.exists()` 判斷 —— macOS TCC 讓 `~/Desktop` 下不存在的路徑也回 True（踩過）。
- `--no-browser`：供 launchd 用,不亂彈瀏覽器。
- **launchd**：home 指 `_workstation/dashboard_server.py --no-browser`;Air 指 `~/code/dashboard/dashboard_server.py --no-browser`（TCC 安全）。
- `🚀 Dashboard.command`（智能版）指 _workstation：已跑→只開瀏覽器;沒跑→啟動。

## 程式碼同步（git / GitHub）

- 主 repo：`github.com/HemanJJ/*`（booking、smartlocker、badminton-crm、Light_code_CRM、badminton_mkt、Cloude-grinds、AI-OS-Pro…）
- home 已 commit+pull 對齊;Air 透過 **git clone（公開）** 或 **rsync from home（私有 repo）** 補齊到 `~/code/<名稱>`。
- dashboard 的路徑解析會自動找到 Air 的 `~/code/...` 或 `~/Booking`。

## Obsidian + 知識庫同步（Syncthing）

- **device ID**：
  - home = `I7ZUS5N-PWTDP6D-FX6MVGY-RMVLKK2-ZZAINHE-OO7GKD7-D5YN426-VIOWBQK`
  - Air = `DNRQRZI-I75MQ2U-4HRJQRG-JBMMAMX-CHO6XBY-VNINKFG-KNEJFHS-O5FPEAH`
- **資料夾 ID**：`obsidian-vault`、`dsh-skills`（兩台 ID 相同,路徑各自指自己的位置）
- 兩台都已用 syncthing API 配好「互認裝置 + 資料夾」,已連線（`connected=True`）並同步（idle）。
- **API**：`curl -H "X-API-Key: <key>" http://localhost:8384/rest/config/...`
  - home key = `abQtnnn3uahHUVNdmS9WnLoiTNsShvjj`、Air key = `TWY3J7cbuJahG5hbfnDjzs7onbzzjNWz`
- 安裝：home `brew install syncthing` + `brew services start syncthing`;Air 用 `/opt/homebrew/bin/brew install syncthing`。
- ⚠️ 若要同步 `~/Documents` 的 vault,需在「系統設定 → 隱私與安全性 → **完整磁碟存取權**」給 syncthing 打勾（若未同步）。

## TCC 重點（macOS 安全限制,踩過很多坑）

- `~/Desktop`、`~/Documents`、`~/Downloads` 受 **TCC** 保護：**SSH / launchd（非 GUI 情境）讀寫會被擋**（`Operation not permitted`）。
- 判據：不能用 `Path.exists()` 判斷 Desktop 路徑是否存在（TCC 誤判為 True）。
- 解法：受 TCC 影響的東西放**非 Desktop** 位置（如 Air 的 `~/code/dashboard`）;或給 syncthing / python3 授「完整磁碟存取權」。
- Air 桌面 `🚀 Dashboard.command` 無法由 SSH 覆寫（TCC）;要改須在 **Air Terminal** 跑 `cp ~/code/dashboard/Dashboard.command ~/Desktop/🚀\ Dashboard.command`。

## DSH（DeepSeek Harness）啟動

- **⚠️ 啟動要加 `web`**：`npx @deepseek-ai/dsh web`。裸跑 `npx @deepseek-ai/dsh` 會報 `--profile <name> is required`（exit 1）。
- `dsh` = 啟動一個 profile；`web` 只是其中一個（瀏覽器 GUI @ 127.0.0.1:3080）。
- 三種用法：
  - `dsh web` — 瀏覽器 GUI
  - `dsh --profile headless "任務"` — 終端跑一次、印結果、退出
  - `dsh --profile tui --resume <session>` — 終端文字界面
- 背景常駐重啟（關窗口不死）：`lsof -ti :3080 | xargs kill -9 2>/dev/null; sleep 1; cd ~/Documents/deepseekharness && nohup npx @deepseek-ai/dsh web > /tmp/dsh.log 2>&1 & sleep 3 && open http://127.0.0.1:3080`
- 已加進 dashboard「系統」分類的「🤖 DSH」項目（一鍵重啟＋開 GUI）。

## 相關

- [[01-專案總覽]]
- [[21-營運晴雨表]]
