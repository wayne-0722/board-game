import { NextResponse } from "next/server";
import { startReflection } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerId } = await req.json();
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少必要資訊" }, { status: 400 });
  }
  const result = startReflection(sessionCode, playerId);
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
