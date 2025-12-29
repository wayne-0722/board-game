import { NextResponse } from "next/server";
import { joinSession } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerName, playerId } = await req.json();
  if (!sessionCode || typeof sessionCode !== "string") {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const session = joinSession({ sessionCode, playerName, playerId });
  const finalId =
    playerId && session.players.some((p) => p.id === playerId)
      ? playerId
      : session.players.at(-1)?.id;
  return NextResponse.json({ session, playerId: finalId });
}
