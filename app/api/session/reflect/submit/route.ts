import { NextResponse } from "next/server";
import { submitReflectionStats } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerId, answers, totalTime } = await req.json();
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少必要資訊" }, { status: 400 });
  }
  const result = submitReflectionStats({
    sessionCode,
    playerId,
    answers,
    totalTime
  });
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
