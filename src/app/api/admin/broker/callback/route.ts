import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userCallbackUrl = new URL("/api/user/broker/callback", request.url);
  userCallbackUrl.search = request.nextUrl.search;
  
  return NextResponse.redirect(userCallbackUrl);
}
