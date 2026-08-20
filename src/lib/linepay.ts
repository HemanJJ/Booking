// LINE Pay v3 線上付款（web）
// 依賴環境變數：
//   LINE_PAY_CHANNEL_ID     —— LINE Pay 商家 ChannelId
//   LINE_PAY_CHANNEL_SECRET —— LINE Pay 商家 ChannelSecret
//   NEXT_PUBLIC_APP_URL     —— 網站對外網址（confirm/cancel 回跳用）
// 未設定 ChannelId/Secret 時，linePayConfigured() 回傳 false，
// 前台會顯示「尚未開通」而非跳出付款。

const LINE_PAY_V3_API = process.env.LINE_PAY_API_URL ?? "https://api-pay.line.me/v3";

export function linePayConfigured(): boolean {
  return Boolean(
    process.env.LINE_PAY_CHANNEL_ID && process.env.LINE_PAY_CHANNEL_SECRET
  );
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-LINE-ChannelId": process.env.LINE_PAY_CHANNEL_ID ?? "",
    "X-LINE-ChannelSecret": process.env.LINE_PAY_CHANNEL_SECRET ?? "",
  };
}

/** 發起 LINE Pay 付款請求，回傳付款網址與 transactionId */
export async function requestLinePayPayment(opts: {
  orderId: string;
  amount: number;
  productName: string;
  confirmUrl: string;
  cancelUrl: string;
}): Promise<{ paymentUrl: string; transactionId: string }> {
  if (!linePayConfigured()) throw new Error("LINE Pay 尚未開通，請洽場館人員");

  const res = await fetch(`${LINE_PAY_V3_API}/payments/request`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: opts.amount,
      currency: "TWD",
      orderId: opts.orderId,
      packages: [
        {
          id: opts.orderId,
          amount: opts.amount,
          name: opts.productName,
          products: [
            { name: opts.productName, quantity: 1, price: opts.amount },
          ],
        },
      ],
      redirectUrls: {
        confirmUrl: opts.confirmUrl,
        cancelUrl: opts.cancelUrl,
      },
    }),
  });

  const data = (await res.json()) as {
    returnCode?: string;
    returnMessage?: string;
    info?: { paymentUrl?: { web?: string }; transactionId?: string };
  };
  if (data.returnCode !== "0000") {
    throw new Error(
      `LINE Pay 請求失敗：${data.returnCode ?? "?"} ${data.returnMessage ?? ""}`
    );
  }
  const paymentUrl = data.info?.paymentUrl?.web;
  const transactionId = data.info?.transactionId;
  if (!paymentUrl || !transactionId) {
    throw new Error("LINE Pay 回應缺少付款網址");
  }
  return { paymentUrl, transactionId };
}

/** 確認付款（buyer 已於 LINE Pay 完成付款後呼叫） */
export async function confirmLinePayPayment(
  transactionId: string,
  amount: number
): Promise<boolean> {
  if (!linePayConfigured()) return false;
  const res = await fetch(
    `${LINE_PAY_V3_API}/payments/${encodeURIComponent(transactionId)}/confirm`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ amount, currency: "TWD" }),
    }
  );
  const data = (await res.json()) as {
    returnCode?: string;
    returnMessage?: string;
  };
  return data.returnCode === "0000";
}

/** confirm/cancel 回跳網址 */
export function linePayConfirmUrl(bookingId: string): string {
  return `${appUrl()}/api/linepay/confirm?bookingId=${encodeURIComponent(bookingId)}`;
}
export function linePayCancelUrl(): string {
  return `${appUrl()}/bookings`;
}
