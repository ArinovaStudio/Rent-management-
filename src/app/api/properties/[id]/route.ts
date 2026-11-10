import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { parsePropertyForm, MAX_IMAGES } from "@/lib/property-form";
import { saveFile, removeFile } from "@/lib/uploads";

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
      documents: true,
    },
  });
  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  if (!canEditProperty(me, property)) {
    return NextResponse.json({ error: "You can't edit this property." }, { status: 403 });
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  const parsed = parsePropertyForm(fd);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Images: existing ones minus removed ones plus new ones must stay within the limit.
  const removeImages = property.images.filter((i) => parsed.removeImageIds.includes(i.id));
  const removeDocs = property.documents.filter((d) => parsed.removeDocIds.includes(d.id));
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

  const imagePaths = await Promise.all(parsed.images.map((f) => saveFile(f, "images", "image")));
  const docRows = await Promise.all(
    parsed.docs.map(async (d) => ({
      name: d.name,
      path: await saveFile(d.file, `docs/${property.id}`, "doc"),
    }))
  );

  // Super Admin edits stay approved. A Property Admin's edit goes back to review.
  const review =
    me.role === "SUPER_ADMIN"
      ? { status: "APPROVED" as const, reviewNote: null, reviewedAt: new Date() }
      : { status: "PENDING" as const, reviewNote: null, reviewedAt: null };

  await prisma.$transaction([
    prisma.property.update({ where: { id }, data: { ...parsed.data, ...review } }),
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
    prisma.propertyImage.createMany({ data: imagePaths.map((path) => ({ propertyId: id, path })) }),
    prisma.propertyDocument.createMany({ data: docRows.map((d) => ({ ...d, propertyId: id })) }),
  ]);

  // Delete the old files only after the database change went through.
  await Promise.all([...removeImages, ...removeDocs].map((f) => removeFile(f.path)));

  return NextResponse.json({ id, status: review.status });
}
