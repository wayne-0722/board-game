import { NextResponse } from "next/server";
import { advanceTurn } from "../../../../src/server/mockSessionStore";

export async function POST(req: Request) {
  const { sessionCode } = await req.json();
  if (!sessionCode) {
    return NextResponse.json({ error: "缺少 sessionCode" }, { status: 400 });
  }
  const session = advanceTurn(sessionCode);
  return NextResponse.json({ session });
}
