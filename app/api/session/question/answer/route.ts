import { NextResponse } from "next/server";
import { submitAnswer } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionCode, selectedIndices } = body ?? {};
  if (!sessionCode || !Array.isArray(selectedIndices)) {
    return NextResponse.json({ error: "缺少 sessionCode 或選項" }, { status: 400 });
  }
  const { session, error } = await submitAnswer({ sessionCode, selectedIndices });
  return NextResponse.json({ session, error });
}
