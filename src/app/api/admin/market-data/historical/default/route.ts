// This API route has been removed
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "This API has been removed" }, { status: 410 });
}
