import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { sendEmailOtp } from "@/lib/email-otp";

export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const r = await sendEmailOtp(me);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.retryAfterSec ? 429 : 400 });
  return NextResponse.json({ ok: true });
}
