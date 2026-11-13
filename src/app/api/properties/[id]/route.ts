import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { parsePropertyForm, MAX_IMAGES, imageOrder } from "@/lib/property-form";
import { saveFile, removeFile, saveSensitiveFile, removeSensitiveFile } from "@/lib/uploads";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      rooms: {
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
      images: true,
      categoryMedia: true,
      documents: true,
      authorityProof: true,
    },
  });
  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  if (!canEditProperty(me, property)) {
    return NextResponse.json({ error: "You can't edit this property." }, { status: 403 });
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  const parsed = parsePropertyForm(fd, me.role);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Images: existing ones minus removed ones plus new ones must stay within the limit.
  const removeImages = property.images.filter((i) => parsed.removeImageIds.includes(i.id));
  const removeDocs = property.documents.filter((d) => parsed.removeDocIds.includes(d.id));
  const keptCategories = new Set(parsed.rooms.map((r) => r.capacity));
  const removeCategoryMedia = property.categoryMedia.filter((m) =>
    parsed.data.type !== "PG" || parsed.removeCategoryMediaIds.includes(m.id) || !keptCategories.has(m.capacity)
  );
  if (parsed.removeCategoryMediaIds.some((mediaId) => !property.categoryMedia.some((m) => m.id === mediaId))) {
    return NextResponse.json({ error: "Unknown category media item." }, { status: 400 });
  }
  if (parsed.categoryMedia.some((m) => !keptCategories.has(m.capacity))) {
    return NextResponse.json({ error: "Upload media only for categories that have rooms." }, { status: 400 });
  }
  for (const capacity of keptCategories) {
    const currentImages = property.categoryMedia.filter((m) => m.capacity === capacity && m.mediaType === "IMAGE" && !removeCategoryMedia.some((r) => r.id === m.id)).length;
    const currentVideos = property.categoryMedia.filter((m) => m.capacity === capacity && m.mediaType === "VIDEO" && !removeCategoryMedia.some((r) => r.id === m.id)).length;
    const newImages = parsed.categoryMedia.filter((m) => m.capacity === capacity && m.mediaType === "IMAGE").length;
    const newVideos = parsed.categoryMedia.filter((m) => m.capacity === capacity && m.mediaType === "VIDEO").length;
    if (currentImages + newImages > 10 || currentVideos + newVideos > 5) {
      return NextResponse.json({ error: `${capacity} seater category allows up to 10 photos and 5 videos.` }, { status: 400 });
    }
  }
  if (property.images.length - removeImages.length + parsed.images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `A property can have up to ${MAX_IMAGES} images.` }, { status: 400 });
  }

  // Rooms: update the ones that came back with an id, create new ones, delete the missing ones.
  const existingIds = new Set(property.rooms.map((r) => r.id));
  const keptIds = new Set<string>();
  for (const r of parsed.rooms) {
    if (r.id) {
      if (!existingIds.has(r.id)) return NextResponse.json({ error: "Unknown room." }, { status: 400 });
      keptIds.add(r.id);
    }
  }
  const dropped = property.rooms.filter((r) => !keptIds.has(r.id));
  const busy = dropped.find((r) => r.allocations.length > 0);

  if (busy) {
    return NextResponse.json(
      { error: `${busy.label} has active residents, so it can't be removed.` },
      { status: 400 }
    );
  }

  for (const input of parsed.rooms) {
    if (!input.id) continue;

    const existing = property.rooms.find((r) => r.id === input.id);

    if (existing && input.capacity < existing.allocations.length) {
      return NextResponse.json({
        error: `${existing.label} has ${existing.allocations.length} active residents. Capacity cannot be reduced below that number.`,
      }, { status: 400 });
    }
  }

  // Optional replacement of the ownership/authority proof (e.g. after the reviewer asked for more
  // information). Validated and stored privately before anything else is written.
  const proofUpload = fd.get("authorityProof");
  const proofFile = proofUpload instanceof File && proofUpload.size > 0 ? proofUpload : null;
  let newProof: Awaited<ReturnType<typeof saveSensitiveFile>> | null = null;
  if (proofFile) {
    newProof = await saveSensitiveFile(proofFile, `property-authority/${property.ownerId}`);
    if ("error" in newProof) return NextResponse.json({ error: newProof.error }, { status: 400 });
  }
  const proofData =
    proofFile && newProof && !("error" in newProof)
      ? {
          path: newProof.path,
          originalName: proofFile.name.slice(0, 200),
          mimeType: newProof.mimeType,
          sizeBytes: newProof.sizeBytes,
          sha256: newProof.sha256,
          uploadedAt: new Date(),
        }
      : null;

  const imagePaths = await Promise.all(parsed.images.map((f) => saveFile(f, "images", "image")));
  const categoryMediaRows = await Promise.all(parsed.categoryMedia.map(async (item) => ({
    propertyId: id,
    capacity: item.capacity,
    mediaType: item.mediaType,
    path: await saveFile(item.file, item.mediaType === "IMAGE" ? "images/pg-categories" : "videos/pg-categories", item.mediaType === "IMAGE" ? "image" : "video"),
    originalName: item.file.name.slice(0, 200),
    mimeType: item.file.type,
    sizeBytes: item.file.size,
  })));
  const docRows = await Promise.all(
    parsed.docs.map(async (d) => ({
      name: d.name,
      path: await saveFile(d.file, `docs/${property.id}`, "doc"),
    }))
  );
  
  const keptImages = property.images.filter((i) => !removeImages.includes(i));
  const order = imageOrder(parsed.imageOrder, keptImages.map((i) => i.id), imagePaths.length);
  let videoPath: string | null | undefined; // undefined = leave the video as it is
  if (parsed.videoFile) videoPath = await saveFile(parsed.videoFile, "videos", "video");
  else if (parsed.removeVideo) videoPath = null;

  // Super Admin edits stay approved. A Property Admin's edit goes back to review.
  const review =
    me.role === "SUPER_ADMIN"
      ? { status: "APPROVED" as const, reviewNote: null, reviewedAt: new Date() }
      : { status: "PENDING" as const, reviewNote: null, reviewedAt: null };

  // An owner's edit after a rejection or an information request is a resubmission: record it.
  const resubmit =
    me.role !== "SUPER_ADMIN" && (property.status === "NEEDS_MORE_INFO" || property.status === "REJECTED");

  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id },
        data: { ...parsed.data, ...review, ...(videoPath !== undefined ? { videoPath } : {}) },
      }),
      ...(proofData
        ? [prisma.propertyAuthorityProof.upsert({
            where: { propertyId: id },
            create: { ...proofData, propertyId: id },
            update: proofData,
          })]
        : []),
      ...(resubmit
        ? [prisma.auditEvent.create({
            data: { subjectType: "PROPERTY", subjectId: id, actorId: me.id, action: "RESUBMIT", fromStatus: property.status, toStatus: "PENDING", note: proofData ? "Replaced ownership proof" : null },
          })]
        : []),
      ...parsed.rooms.map(({ id: roomId, ...r }) => {
        const existing = roomId
          ? property.rooms.find((room) => room.id === roomId)
          : null;

        return roomId
          ? prisma.room.update({
              where: { id: roomId },
              data: {
                ...r,
                occupied: existing?.allocations.length ?? 0,
              },
            })
          : prisma.room.create({
              data: {
                ...r,
                occupied: 0,
                propertyId: id,
              },
            });
      }),
      prisma.room.deleteMany({ where: { id: { in: dropped.map((r) => r.id) } } }),
      prisma.propertyImage.deleteMany({ where: { id: { in: removeImages.map((i) => i.id) } } }),
      prisma.propertyDocument.deleteMany({ where: { id: { in: removeDocs.map((d) => d.id) } } }),
      prisma.roomCategoryMedia.deleteMany({ where: { id: { in: removeCategoryMedia.map((m) => m.id) } } }),
      ...(categoryMediaRows.length ? [prisma.roomCategoryMedia.createMany({ data: categoryMediaRows })] : []),
      ...keptImages.map((i) => prisma.propertyImage.update({ where: { id: i.id }, data: { sortOrder: order.indexOf(i.id) } })),
      prisma.propertyImage.createMany({
        data: imagePaths.map((path, i) => ({ propertyId: id, path, sortOrder: order.indexOf(`new:${i}`) })),
      }),
      prisma.propertyDocument.createMany({ data: docRows.map((d) => ({ ...d, propertyId: id })) }),
    ]);
  } catch (err) {
    if (proofData) await removeSensitiveFile(proofData.path);
    if (typeof videoPath === "string") await removeFile(videoPath);
    await Promise.all(categoryMediaRows.map((media) => removeFile(media.path)));
    throw err;
  }

  // Delete the old files only after the database change went through.
  await Promise.all([...removeImages, ...removeDocs, ...removeCategoryMedia].map((f) => removeFile(f.path)));
  if (proofData && property.authorityProof) await removeSensitiveFile(property.authorityProof.path);
  if (videoPath !== undefined && property.videoPath) await removeFile(property.videoPath);
  
  return NextResponse.json({ id, status: review.status });
}
