import { NextResponse } from "next/server";
import { voteEndGame } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerId } = body ?? {};
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少 sessionCode 或 playerId" }, { status: 400 });
  }
  const { session, endVotes, threshold, error } = await voteEndGame(sessionCode, playerId);
  return NextResponse.json({ session, endVotes, threshold, error });
}
