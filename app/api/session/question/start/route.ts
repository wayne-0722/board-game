import { NextResponse } from "next/server";
import { startQuestion } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode } = await req.json();
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const result = startQuestion(sessionCode);
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
