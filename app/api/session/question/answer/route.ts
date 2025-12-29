import { NextResponse } from "next/server";
import { submitAnswer } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, selectedIndex } = await req.json();
  if (sessionCode === undefined || selectedIndex === undefined) {
    return NextResponse.json({ error: "缺少參數" }, { status: 400 });
  }
  const result = submitAnswer({ sessionCode, selectedIndex });
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
