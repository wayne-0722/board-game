import { NextResponse } from "next/server";
import { forfeitQuestion } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode } = body ?? {};
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const { session } = await forfeitQuestion(sessionCode);
  return NextResponse.json({ session });
}
