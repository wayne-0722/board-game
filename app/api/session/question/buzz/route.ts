import { NextResponse } from "next/server";
import { buzzIn } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, playerId } = await req.json();
  if (!sessionCode || !playerId) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const result = buzzIn({ sessionCode, playerId });
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
