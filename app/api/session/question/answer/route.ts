import { NextResponse } from "next/server";
import { submitAnswer } from "../../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode, selectedIndices } = await req.json();
  if (sessionCode === undefined || selectedIndices === undefined) {
    return NextResponse.json({ error: "Missing sessionCode or selectedIndices" }, { status: 400 });
  }
  const result = submitAnswer({ sessionCode, selectedIndices });
  if (result.error) {
    return NextResponse.json({ error: result.error, session: result.session }, { status: 400 });
  }
  return NextResponse.json({ session: result.session });
}
