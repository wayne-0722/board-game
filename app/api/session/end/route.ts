import { NextResponse } from "next/server";
import { voteEndGame } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerId } = await req.json();
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const result = voteEndGame(sessionCode, playerId);
  if ((result as any).error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ session: result.session, endVotes: result.endVotes, threshold: (result as any).threshold });
}
