import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { toClientState, profileWithDocs } from "@/lib/owner-profile";
import { CONSENTS, POLICY_VERSIONS } from "@/lib/policies";

export const dynamic = "force-dynamic";

// The wizard loads this to decide what to show: a fresh sign-up form (401), or the saved draft.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await prisma.ownerProfile.findUnique({ where: { userId: me.id }, include: profileWithDocs });
  // No profile = account from before onboarding existed (or an admin/manager): nothing to complete.
  if (!profile) return NextResponse.json({ legacy: true });

  return NextResponse.json(
    { ...toClientState(me, profile), policies: POLICY_VERSIONS, consents: CONSENTS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
