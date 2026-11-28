import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { UPLOAD_ROOT, MIME_BY_EXT } from "@/lib/uploads";

// Opens a tenant's uploaded ID proof for staff who run this property (owner, Super Admin, assigned manager).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, docId } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!property || !(await canOperateProperty(me, property))) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const document = await prisma.residentDocument.findFirst({ where: { id: docId, allocation: { room: { propertyId: id } } } });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const abs = path.resolve(UPLOAD_ROOT, document.path);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const contentType = MIME_BY_EXT[path.extname(abs).toLowerCase()];
  if (!contentType) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const file = await readFile(abs);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(document.name).replace(/["\\]/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
}
