import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseReview, reviewProperty } from "@/lib/review";

// Super Admin only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const parsed = parseReview(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const { id } = await params;
  const r = await reviewProperty(me.id, id, parsed.action, parsed.note);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
