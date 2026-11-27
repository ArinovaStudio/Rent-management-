import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/owner-validation";
import { checkFile, removeFile, removeSensitiveFile, saveFile, saveSensitiveFile } from "@/lib/uploads";

const bad = (fieldErrors: Record<string, string>) => NextResponse.json({ error: "Check the highlighted fields.", fieldErrors }, { status: 400 });

// Shared by every route that edits a co-owner / manager. The caller must already have checked permission.
export async function applyPersonUpdate(req: Request, userId: string) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const str = (k: string) => String(fd.get(k) ?? "").trim().replace(/\s+/g, " ");
  const e: Record<string, string> = {};

  const name = str("name");
  if (name.length < 2 || name.length > 120) e.name = "Enter the person's full legal name.";
  const phone = normalizeMobile(str("phone"));
  if (!phone) e.phone = "Enter a valid 10-digit mobile number.";
  const age = str("age") ? Number(str("age")) : null;
  if (age !== null && (!Number.isInteger(age) || age < 18 || age > 100)) e.age = "Enter an age between 18 and 100.";
  const addressLine1 = str("addressLine1");
  const addressLine2 = str("addressLine2");
  const city = str("city");
  const state = str("state");
  const postalCode = str("postalCode");
  if (addressLine1.length < 3 || addressLine1.length > 200) e.addressLine1 = "Enter the street address.";
  if (!city) e.city = "Enter the city.";
  if (!state) e.state = "Enter the state.";
  if (!/^\d{6}$/.test(postalCode)) e.postalCode = "Enter a 6-digit PIN code.";

  const photo = fd.get("photo");
  const newPhoto = photo instanceof File && photo.size > 0 ? photo : null;
  const photoError = newPhoto ? checkFile(newPhoto, "image") : null;
  if (photoError) e.photo = photoError;
  if (Object.keys(e).length) return bad(e);

  const profile = await prisma.ownerProfile.findUnique({ where: { userId }, select: { id: true, photoPath: true, documents: { where: { type: "ID_DOCUMENT" }, select: { id: true, path: true } } } });
  if (!profile) return NextResponse.json({ error: "This person has no profile to edit." }, { status: 404 });

  // Optional replacement of the ID document (stored privately, old file removed after the save).
  const docUpload = fd.get("document");
  const docFile = docUpload instanceof File && docUpload.size > 0 ? docUpload : null;
  let doc: Awaited<ReturnType<typeof saveSensitiveFile>> | null = null;
  if (docFile) {
    doc = await saveSensitiveFile(docFile, `owners/${profile.id}`);
    if ("error" in doc) return bad({ document: doc.error });
  }

  const photoPath = newPhoto ? await saveFile(newPhoto, "images/people", "image") : null;
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name } }),
      prisma.ownerProfile.update({
        where: { userId },
        data: { phone: phone!, age, addressLine1, addressLine2: addressLine2 || null, city, state, postalCode, ...(photoPath ? { photoPath } : {}) },
      }),
      ...(docFile && doc && !("error" in doc)
        ? [
            prisma.sensitiveDocument.create({
              data: { ownerProfileId: profile.id, type: "ID_DOCUMENT", path: doc.path, originalName: docFile.name.slice(0, 200), mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, sha256: doc.sha256 },
            }),
            prisma.sensitiveDocument.deleteMany({ where: { id: { in: profile.documents.map((d) => d.id) } } }),
          ]
        : []),
    ]);
  } catch (err) {
    if (photoPath) await removeFile(photoPath);
    if (doc && !("error" in doc)) await removeSensitiveFile(doc.path);
    if ((err as { code?: string }).code === "P2002") return bad({ phone: "That mobile number is already used by another account." });
    throw err;
  }
  if (photoPath && profile.photoPath) await removeFile(profile.photoPath);
  if (doc && !("error" in doc)) await Promise.all(profile.documents.map((d) => removeSensitiveFile(d.path)));

  return NextResponse.json({ ok: true, name });
}
