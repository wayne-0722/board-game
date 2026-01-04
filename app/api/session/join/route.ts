import { NextResponse } from "next/server";
import { joinSession } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerName, playerId } = body ?? {};
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const normalized = String(sessionCode).trim();
  if (!/^\d{2}$/.test(normalized)) {
    return NextResponse.json({ error: "房間號需為 2 位數" }, { status: 400 });
  }
  const session = await joinSession({ sessionCode: normalized, playerName, playerId });
  return NextResponse.json({ session });
}
