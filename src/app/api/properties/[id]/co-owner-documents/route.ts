import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { removeSensitiveFile, saveSensitiveFile } from "@/lib/uploads";

// Only the co-owner assigned to this property can submit their own proof.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id: propertyId } = await params;
  const assignment = await prisma.propertyCoOwner.findUnique({
    where: { propertyId_userId: { propertyId, userId: me.id } },
    select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "You are not assigned as a co-owner of this property." }, { status: 403 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const upload = fd.get("document");
  if (!name) return NextResponse.json({ error: "Enter a document name." }, { status: 400 });
  if (!(upload instanceof File) || upload.size === 0) return NextResponse.json({ error: "Choose a proof document." }, { status: 400 });

  const stored = await saveSensitiveFile(upload, `property-co-owner/${assignment.id}`);
  if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });
  try {
    const document = await prisma.propertyCoOwnerDocument.create({
      data: {
        propertyCoOwnerId: assignment.id, name, path: stored.path,
        originalName: upload.name.slice(0, 200), mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes, sha256: stored.sha256,
      },
      select: { id: true, name: true, originalName: true, uploadedAt: true },
    });
    return NextResponse.json({ ok: true, document }, { status: 201 });
  } catch (error) {
    await removeSensitiveFile(stored.path);
    throw error;
  }
}
