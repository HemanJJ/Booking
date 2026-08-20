import { NextResponse } from "next/server";

/** LINE Pay 付款取消回跳（cancelUrl） */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/bookings?pay=cancelled", url.origin));
}
