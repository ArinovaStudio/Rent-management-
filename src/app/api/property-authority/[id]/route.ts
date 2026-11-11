import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { readSensitiveFile } from "@/lib/uploads";

// Property ownership proof. Readable by the property's owner and the Super Admin only. [id] is the property id.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const proof = await prisma.propertyAuthorityProof.findUnique({
    where: { propertyId: id },
    include: { property: { select: { ownerId: true } } },
  });
  if (!proof || (me.role !== "SUPER_ADMIN" && proof.property.ownerId !== me.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const file = await readSensitiveFile(proof.path);
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.documentAccessLog.create({
    data: { documentId: proof.id, actorId: me.id, actorRole: me.role, action: "VIEW" },
  });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": proof.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
