import { NextResponse } from "next/server";
import { settleReflection } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode } = await req.json();
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const result = settleReflection(sessionCode);
  if ((result as any).error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ session: result.session, leaderboard: result.leaderboard });
}
