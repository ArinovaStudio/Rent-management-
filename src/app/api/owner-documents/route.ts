import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { removeSensitiveFile, saveSensitiveFile } from "@/lib/uploads";

// Replaces (or adds) the owner's ID document or address proof when the reviewer asked for more
// information. Sends the account back to KYC review.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await prisma.ownerProfile.findUnique({ where: { userId: me.id }, include: { documents: true } });
  if (!profile) return NextResponse.json({ error: "No owner profile on this account." }, { status: 404 });
  if (profile.verificationStatus !== "NEEDS_MORE_INFO") {
    return NextResponse.json({ error: "No document is being requested right now." }, { status: 409 });
  }

  const fd = await req.formData().catch(() => null);
  const kind = fd?.get("type") === "ADDRESS_PROOF" ? "ADDRESS_PROOF" : "ID_DOCUMENT";
  const upload = fd?.get("document");
  if (!(upload instanceof File) || upload.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const stored = await saveSensitiveFile(upload, `owners/${profile.id}`);
  if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });

  const old = profile.documents.find((d) => d.type === kind);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sensitiveDocument.create({
        data: {
          ownerProfileId: profile.id, type: kind, path: stored.path,
          originalName: upload.name.slice(0, 200), mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes, sha256: stored.sha256,
        },
      });
      if (old) await tx.sensitiveDocument.delete({ where: { id: old.id } });
      await tx.ownerProfile.update({
        where: { id: profile.id },
        data: { verificationStatus: "KYC_PENDING", statusUpdatedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { subjectType: "OWNER_KYC", subjectId: profile.id, actorId: me.id, action: "RESUBMIT", fromStatus: "NEEDS_MORE_INFO", toStatus: "KYC_PENDING", note: `Replaced ${kind === "ADDRESS_PROOF" ? "address proof" : "ID document"}` },
      });
    });
  } catch (err) {
    await removeSensitiveFile(stored.path);
    throw err;
  }
  if (old) await removeSensitiveFile(old.path);
  return NextResponse.json({ ok: true });
}
