import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  verifyLineState,
  exchangeLineCode,
  verifyLineIdToken,
  getLineProfile,
} from "@/lib/line";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/account/login?error=${encodeURIComponent(reason)}`, request.url)
    );

  if (error) {
    return fail(error === "access_denied" ? "line_cancelled" : "line_error");
  }
  if (!code || !state) return fail("line_invalid");

  let nonce: string;
  try {
    nonce = await verifyLineState(state);
  } catch {
    return fail("line_invalid_state");
  }

  try {
    const tokens = await exchangeLineCode(code);
    const idToken = await verifyLineIdToken(tokens.id_token, nonce);
    const lineUserId = idToken.sub;

    let member = await prisma.member.findUnique({ where: { lineUserId } });

    if (!member) {
      let name = idToken.name ?? "LINE 會員";
      let pictureUrl = idToken.picture ?? null;

      const profile = await getLineProfile(tokens.access_token);
      if (profile) {
        name = profile.displayName || name;
        pictureUrl = profile.pictureUrl ?? pictureUrl;
      }

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
    const res = NextResponse.redirect(new URL("/bookings", request.url));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("LINE login error:", e);
    return fail("line_error");
  }
}
