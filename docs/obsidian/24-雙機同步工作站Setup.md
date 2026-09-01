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

- 檔案：`~/Desktop/projects/code/dashboard_server.py` + `dashboard.html`（Air 上放在 `~/code/dashboard/`）
- 功能：加了「**🖥 跨機同步**」分頁 + 4 支 API（`/api/machine`、`/api/sync-status`、`/api/parity`、`/api/sync-git`）+ **路徑自動解析**
- **路徑解析（關鍵）**：`resolve_path` 用**掃描（iterdir）**找專案（`ALT_ROOTS` = `~/Desktop/projects/code`、`~/code`、`~/Documents/GitHub`、`~/Booking`）。
  - ⚠️ **千萬不要用 `Path.exists()` 判斷** —— macOS TCC 會讓 `~/Desktop` 下**不存在的路徑也回 True**,導致解析失效（踩過這個坑）。
- `--no-browser` 參數：供 launchd 自動啟動用,不亂彈瀏覽器。
- **launchd 自動啟動**（兩台都要）：
  - home：`~/Library/LaunchAgents/com.difly.dashboard.plist`（`/opt/homebrew/bin/python3` → `~/Desktop/projects/code/dashboard_server.py --no-browser`,RunAtLoad+KeepAlive）
  - Air：指向 **`~/code/dashboard/dashboard_server.py --no-browser`**（放 `~/code/dashboard` 而非 `~/Desktop` —— **TCC 安全,launchd 才不會被擋**）
- `🚀 Dashboard.command`（**智能版**）：已跑→只開瀏覽器;沒跑→啟動新版。**不再 pkill / 搶 8899 / 用舊 `_workstation`**。
- 舊版 `~/Desktop/projects/code/_workstation/dashboard_server.py`：已被取代,勿再自動啟動（它一直搶 8899、指舊版,是之前「還不一樣+報錯」的元凶）。

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

## 相關

- [[01-專案總覽]]
- [[21-營運晴雨表]]
