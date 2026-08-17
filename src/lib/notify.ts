// LINE 通知（給店家的訂位/取消提醒）
// 依賴環境變數：
//   LINE_MESSAGING_ACCESS_TOKEN —— 你的 LINE Bot Channel Access Token
//   LINE_ADMIN_USER_ID           —— 你的 LINE userId（追蹤 Bot 後可得）
// 未設定時會靜默略過，不影響系統運作。

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLineAdminNotify(text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_ACCESS_TOKEN;
  const to = process.env.LINE_ADMIN_USER_ID;
  if (!token || !to) return;

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
      console.error("[LINE notify] 失敗:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[LINE notify] 錯誤:", e);
  }
}
