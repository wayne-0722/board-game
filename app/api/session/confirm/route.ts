import { NextResponse } from "next/server";
import { confirmSeat } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerId, playerName } = await req.json();
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少 sessionCode 或 playerId" }, { status: 400 });
  }
  const session = confirmSeat({ sessionCode, playerId, playerName });
  return NextResponse.json({ session });
}
