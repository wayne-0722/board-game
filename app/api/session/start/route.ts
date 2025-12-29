import { NextResponse } from "next/server";
import { startGame } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode } = await req.json();
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const session = startGame(sessionCode);
  return NextResponse.json({ session });
}
