import { NextResponse } from "next/server";
import { buzzIn } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, playerId } = body ?? {};
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少 sessionCode 或 playerId" }, { status: 400 });
  }
  const { session, error } = await buzzIn({ sessionCode, playerId });
  return NextResponse.json({ session, error });
}
