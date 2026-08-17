import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { verifyLineIdToken } from "@/lib/line";

/**
 * LIFF 登入：前端（LINE 內開啟的 /liff 頁）取得 id_token 後送來這裡。
 * 驗證通過 → 依 lineUserId 建立/找到會員 → 寫入 session cookie。
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const idToken = body.idToken;
  if (!idToken) {
    return NextResponse.json({ error: "缺少 idToken" }, { status: 400 });
  }

  try {
    const payload = await verifyLineIdToken(idToken); // LIFF 不帶 nonce
    const lineUserId = payload.sub;

    let member = await prisma.member.findUnique({ where: { lineUserId } });
    if (!member) {
      const name = payload.name ?? "LINE 會員";
      const pictureUrl = payload.picture ?? null;
      member = await prisma.member.create({
        data: {
          name,
          lineUserId,
          lineName: name,
          linePictureUrl: pictureUrl,
        },
      });
    }

    const token = await signSessionToken(member.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("LINE LIFF login error:", e);
    return NextResponse.json({ error: "LINE 登入失敗" }, { status: 401 });
  }
}
