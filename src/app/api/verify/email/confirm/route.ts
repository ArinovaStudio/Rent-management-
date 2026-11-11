import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { confirmEmailOtp } from "@/lib/email-otp";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const r = await confirmEmailOtp(me.id, code);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
