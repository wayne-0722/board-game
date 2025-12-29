import { NextResponse } from "next/server";
import { getState } from "../../../../src/server/mockSessionStore";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionCode = searchParams.get("sessionCode");
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const session = getState(sessionCode);
  return NextResponse.json({ session });
}
