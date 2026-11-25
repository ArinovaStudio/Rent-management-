import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { sendEmailOtp } from "@/lib/email-otp";

// Emails a 6-digit code that authorises one password change. Only for accounts that signed themselves up;
// accounts created by an admin change their temporary password with the current one instead.
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.createdById) return NextResponse.json({ error: "Use your current password to change it." }, { status: 400 });
  const r = await sendEmailOtp(me, "PASSWORD");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.retryAfterSec ? 429 : 400 });
  return NextResponse.json({ ok: true });
}
