import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { readSensitiveFile } from "@/lib/uploads";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const doc = await prisma.propertyCoOwnerDocument.findUnique({
    where: { id },
    include: { propertyCoOwner: { include: { property: { select: { ownerId: true } } } } },
  });
  const allowed = !!doc && (
    me.role === "SUPER_ADMIN" ||
    doc.propertyCoOwner.userId === me.id ||
    doc.propertyCoOwner.property.ownerId === me.id
  );
  if (!doc || !allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const file = await readSensitiveFile(doc.path);
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.documentAccessLog.create({ data: { documentId: doc.id, actorId: me.id, actorRole: me.role, action: "VIEW" } });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
