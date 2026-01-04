import { NextResponse } from "next/server";
import { forfeitQuestion } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode } = await req.json();
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const result = forfeitQuestion(sessionCode);
  return NextResponse.json({ session: result.session });
}
