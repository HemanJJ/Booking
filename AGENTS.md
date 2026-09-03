<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## ⚠️ 多機共同開發（重要，避免撞檔）

本 repo（HemanJJ/Booking）由**多台機器 / 多個 session 同時修改**（這台 Mac Air ＋ 另一台 Mac Mini/POS，兩邊都 push 到同一 repo）。為避免衝突：

1. **修改任何 code 之前，先 `git pull`（或 `git fetch && git rebase origin/main`）**，確保本地是最新。
2. **push 前若被拒（non-fast-forward）＝ 遠端有新 commit** → 先 `git fetch`＋`git rebase origin/main` 再 push，**不要 `git push -f`**。
3. **兩台不要同時改同一個檔案**。若需要（例：HeaderInner、booking.ts 等共用檔），先跟對方講好誰改，或只由一邊改。
4. 改動前後先確認 `origin/main` 進度，git log 確認沒有互相覆蓋。
5. 部署：`npx vercel --prod --yes --token="$(cat .vercel-token)"`（或 `./deploy.sh`，需先有 `.vercel-token`）。

