import { NextResponse } from "next/server";
import { submitReflectionStats } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerId, answers, totalTime } = body ?? {};
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少 sessionCode 或 playerId" }, { status: 400 });
  }
  const { session, error } = await submitReflectionStats({
    sessionCode,
    playerId,
    answers,
    totalTime
  });
  return NextResponse.json({ session, error });
}
