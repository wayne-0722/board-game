import { NextResponse } from "next/server";
import { joinSession } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerName, playerId, playerToken } = body ?? {};
  if (!sessionCode) {
    return NextResponse.json({ error: "Missing sessionCode" }, { status: 400 });
  }
  const normalized = String(sessionCode).trim();
  if (!/^\d{2}$/.test(normalized)) {
    return NextResponse.json({ error: "Session code must be 2 digits" }, { status: 400 });
  }
  const result = await joinSession({ sessionCode: normalized, playerName, playerId, playerToken });
  return NextResponse.json({
    session: result.session,
    playerId: result.playerId,
    playerToken: result.playerToken
  });
}
