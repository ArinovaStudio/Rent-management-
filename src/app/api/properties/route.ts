import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { parsePropertyForm, MAX_IMAGES, imageOrder } from "@/lib/property-form";
import { saveFile, removeFile, saveSensitiveFile, removeSensitiveFile } from "@/lib/uploads";
import { getVerificationStatus, hasUnfinishedOnboarding } from "@/lib/owner-status";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canManageProperties(me.role, await getVerificationStatus(me.id))) {
    return NextResponse.json(
      { error: "Your account must be verified before you can add properties." },
      { status: 403 }
    );
  }

  if (await hasUnfinishedOnboarding(me.id)) {
    return NextResponse.json({ error: "Finish your registration before adding properties." }, { status: 403 });
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const parsed = parsePropertyForm(fd, me.role);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `You can upload up to ${MAX_IMAGES} images.` }, { status: 400 });
  }

  // Super Admin may create on behalf of a Property Admin; everyone else owns what they create.
  let ownerId = me.id;
  const requestedOwner = String(fd.get("ownerId") ?? "");
  if (me.role === "SUPER_ADMIN" && requestedOwner) {
    const owner = await prisma.user.findUnique({ where: { id: requestedOwner } });
    if (!owner || owner.role !== "PROPERTY_ADMIN") {
      return NextResponse.json({ error: "Choose a valid Property Admin." }, { status: 400 });
    }
    ownerId = owner.id;
  }

  const requestedCoOwner = String(fd.get("coOwnerId") ?? "").trim();
  let coOwnerId: string | null = null;
  if (me.role === "SUPER_ADMIN" && requestedCoOwner) {
    if (!requestedOwner) {
      return NextResponse.json({ error: "Choose a primary owner before assigning a co-owner." }, { status: 400 });
    }
    if (requestedCoOwner === ownerId) {
      return NextResponse.json({ error: "The primary owner and co-owner must be different people." }, { status: 400 });
    }
    const coOwner = await prisma.user.findUnique({ where: { id: requestedCoOwner }, select: { id: true, role: true } });
    if (!coOwner || coOwner.role !== "PROPERTY_ADMIN") {
      return NextResponse.json({ error: "Choose a valid registered Property Admin as co-owner." }, { status: 400 });
    }
    coOwnerId = coOwner.id;
  } else if (requestedCoOwner) {
    return NextResponse.json({ error: "Only a Super Admin can assign a co-owner during property creation." }, { status: 403 });
  }

  // Super Admin's own listings go live immediately; Property Admin's always wait for review,
  // even when the owner is VERIFIED (account KYC is not proof of this property's ownership).
  const status = me.role === "SUPER_ADMIN" ? "APPROVED" : "PENDING";

  // An owner's first property needs ownership/authorization proof, stored apart from their KYC.
  let proof: Awaited<ReturnType<typeof saveSensitiveFile>> | null = null;
  let proofName = "";
  if (me.role === "PROPERTY_ADMIN") {
    const upload = fd.get("authorityProof");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    const isFirst = (await prisma.property.count({ where: { ownerId } })) === 0;
    if (!file && isFirst) {
      return NextResponse.json({ error: "Upload proof that you own or are authorised to let this property." }, { status: 400 });
    }
    if (file) {
      proof = await saveSensitiveFile(file, `property-authority/${ownerId}`);
      if ("error" in proof) return NextResponse.json({ error: proof.error }, { status: 400 });
      proofName = file.name.slice(0, 200);
    }
  }

  let property;
  try {
    property = await prisma.property.create({
      data: {
        ...parsed.data,
        ownerId,
        status,
        rooms: { create: parsed.rooms.map(({ id: _id, ...r }) => r) },
        ...(coOwnerId ? { coOwners: { create: { userId: coOwnerId, assignedById: me.id } } } : {}),
        ...(proof && !("error" in proof)
          ? {
              authorityProof: {
                create: {
                  path: proof.path,
                  originalName: proofName,
                  mimeType: proof.mimeType,
                  sizeBytes: proof.sizeBytes,
                  sha256: proof.sha256,
                },
              },
            }
          : {}),
      },
    });
  } catch (err) {
    if (proof && !("error" in proof)) await removeSensitiveFile(proof.path);
    throw err;
  }

  const imagePaths = await Promise.all(parsed.images.map((f) => saveFile(f, "images", "image")));
  const categoryMediaRows = await Promise.all(parsed.categoryMedia.map(async (item) => ({
    propertyId: property.id,
    capacity: item.capacity,
    mediaType: item.mediaType,
    path: await saveFile(item.file, item.mediaType === "IMAGE" ? "images/pg-categories" : "videos/pg-categories", item.mediaType === "IMAGE" ? "image" : "video"),
    originalName: item.file.name.slice(0, 200),
    mimeType: item.file.type,
    sizeBytes: item.file.size,
  })));
  const order = imageOrder(parsed.imageOrder, [], imagePaths.length);
  const videoPath = parsed.videoFile ? await saveFile(parsed.videoFile, "videos", "video") : null;
  const docRows = await Promise.all(
    parsed.docs.map(async (d) => ({
      name: d.name,
      path: await saveFile(d.file, `docs/${property.id}`, "doc"),
    }))
  );
  try {
    await prisma.$transaction([
      prisma.propertyImage.createMany({
        data: imagePaths.map((path, i) => ({ propertyId: property.id, path, sortOrder: order.indexOf(`new:${i}`) })),
      }),
      prisma.propertyDocument.createMany({ data: docRows.map((d) => ({ ...d, propertyId: property.id })) }),
      ...(categoryMediaRows.length ? [prisma.roomCategoryMedia.createMany({ data: categoryMediaRows })] : []),
      ...(videoPath ? [prisma.property.update({ where: { id: property.id }, data: { videoPath } })] : []),
    ]);
  } catch (err) {
    await Promise.all(categoryMediaRows.map((media) => removeFile(media.path)));
    throw err;
  }

  return NextResponse.json({ id: property.id, status }, { status: 201 });
}
