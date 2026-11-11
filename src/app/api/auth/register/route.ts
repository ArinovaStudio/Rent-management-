import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/session";
import { validateRegister } from "@/lib/owner-validation";

// Wizard step 1 for email/password sign-ups. Creates the account and an empty owner profile, then
// signs the user in so steps 2 and 3 can be saved (and resumed) against it.
// Public sign-up creates a Property Admin. Super Admin is seeded; managers get added by admins later.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = validateRegister(body && typeof body === "object" ? body : {});
  if (!parsed.ok) {
    return NextResponse.json({ error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors }, { status: 400 });
  }
  const { email, password, legalName, accountType, phone } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in to continue.", fieldErrors: { email: "Already registered." } },
      { status: 409 }
    );
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: legalName,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        // Email is NOT verified here. That needs an email OTP/link (Phase 2).
        ownerProfile: { create: { accountType, legalName, phone, completedSteps: 1 } },
      },
    });
  } catch (err) {
    // Two sign-ups racing on the same email
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists. Sign in to continue." }, { status: 409 });
    }
    throw err;
  }

  const res = NextResponse.json({ ok: true }, { status: 201 });
  await startSession(res, user);
  return res;
}
