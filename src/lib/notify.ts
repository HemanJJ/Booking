// LINE 通知（給店家的訂位/取消提醒）
// 依賴環境變數：
//   LINE_MESSAGING_ACCESS_TOKEN —— 你的 LINE Bot Channel Access Token
//   LINE_ADMIN_USER_IDS          —— 收件人 userId，多個用半形逗號分隔（例："Uxxx,Uyyy"）
//   LINE_ADMIN_USER_ID           —— 單一收件人（向後相容；未設 LINE_ADMIN_USER_IDS 時採用）
// 未設定時會靜默略過，不影響系統運作。

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLineAdminNotify(text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  const raw = process.env.LINE_ADMIN_USER_IDS || process.env.LINE_ADMIN_USER_ID || "";
  const recipients = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(`[LINE notify] token=${token ? "有" : "無"}，收件人 ${recipients.length} 位`);
  if (!token || recipients.length === 0) return;

  for (const to of recipients) {
    try {
      const res = await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          messages: [{ type: "text", text }],
        }),
      });
      if (!res.ok) {
        console.error(`[LINE notify] 失敗 ${to.slice(0, 6)}… ${res.status} ${await res.text()}`);
      } else {
        console.log(`[LINE notify] 成功 ${to.slice(0, 6)}…`);
      }
    } catch (e) {
      console.error("[LINE notify] 錯誤:", e);
    }
  }
}
