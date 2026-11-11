import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { readSensitiveFile } from "@/lib/uploads";

// The only way to read a KYC file: the owner it belongs to, or a Super Admin.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    // Access token probably expired: refresh, then come back here.
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const doc = await prisma.sensitiveDocument.findUnique({
    where: { id },
    include: { ownerProfile: { select: { userId: true } } },
  });
  // Same answer whether it doesn't exist or isn't yours, so ids can't be probed
  if (!doc || (me.role !== "SUPER_ADMIN" && doc.ownerProfile.userId !== me.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const file = await readSensitiveFile(doc.path);
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Access log: who opened which document. Never holds file contents or ID numbers.
  await prisma.documentAccessLog.create({
    data: { documentId: doc.id, actorId: me.id, actorRole: me.role, action: "VIEW" },
  });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
