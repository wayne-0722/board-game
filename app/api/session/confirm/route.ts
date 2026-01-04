import { NextResponse } from "next/server";
import { confirmSeat } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerId, playerName } = body ?? {};
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少 sessionCode 或 playerId" }, { status: 400 });
  }
  const session = await confirmSeat({ sessionCode, playerId, playerName });
  return NextResponse.json({ session });
}
