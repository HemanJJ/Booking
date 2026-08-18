---
tags: [difly, 球場預約, LINE]
created: 2026-08-18
---

# LINE 整合

## 三種 LINE 能力（別搞混）

| 能力 | 用途 | 用在哪 |
|------|------|--------|
| **LINE Login（OAuth）** | 網站「用 LINE 登入」，拿 `lineUserId` | 球場系統登入 |
| **LIFF** | 在 LINE App 內開網頁，自動帶身分 | Rich Menu「預訂場地」 |
| **Messaging API（Bot）** | 官方帳號收發訊息、推播 | 客服＋訂位通知 |

## 關鍵 ID

| 項目 | 值 |
|------|-----|
| LINE Login channel | `1660947211`（與租拍共用） |
| LIFF（預訂場地） | `1660947211-e5z12ax6`，Endpoint=`/liff` |
| 官方帳號 Bot | `@014uppgb`（羽拍有約_太平永成） |
| 你的 LINE userId | 見 [[10-資安與金鑰]] |

## 流程

- **網頁登入**：`/api/auth/line/start` → 授權 → `/api/auth/line/callback`。
- **LIFF 登入**：Rich Menu → LIFF URL → `/liff` 頁 → `getIDToken()` → `/api/auth/line/liff`。
- **訂位通知**：訂位/取消 → `sendLineAdminNotify()` → 推播到店家 LINE。

## 踩過的坑（重要）

- LINE JWKS 金鑰網址是 **`https://api.line.me/oauth2/v2.1/certs`**，不是 `access.line.me`（後者 404）。
- Callback URL、LIFF Endpoint URL 都要設成**正式網址**。
- webhook URL 設在 **Messaging API channel**，不是 Login channel。

## 相關

- [[10-資安與金鑰]]
- [[07-部署上線]]
