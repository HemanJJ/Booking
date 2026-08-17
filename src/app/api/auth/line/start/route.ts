import { NextResponse } from "next/server";
import {
  isLineConfigured,
  createLineState,
  buildLineAuthorizeUrl,
} from "@/lib/line";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isLineConfigured()) {
    const url = new URL("/account/login", request.url);
    url.searchParams.set("error", "line_not_configured");
    return NextResponse.redirect(url);
  }

  const { state, nonce } = await createLineState();
  const authorizeUrl = buildLineAuthorizeUrl(state, nonce);
  return NextResponse.redirect(authorizeUrl);
}
