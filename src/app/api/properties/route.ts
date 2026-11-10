import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { parsePropertyForm, MAX_IMAGES } from "@/lib/property-form";
import { saveFile } from "@/lib/uploads";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!canManageProperties(me.role)) {
    return NextResponse.json({ error: "You can't create properties." }, { status: 403 });
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const parsed = parsePropertyForm(fd);
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

  // Super Admin's own listings go live immediately; Property Admin's wait for review.
  const status = me.role === "SUPER_ADMIN" ? "APPROVED" : "PENDING";

  const property = await prisma.property.create({
    data: {
      ...parsed.data,
      ownerId,
      status,
      rooms: { create: parsed.rooms.map(({ id: _id, ...r }) => r) },
    },
  });

  const imagePaths = await Promise.all(parsed.images.map((f) => saveFile(f, "images", "image")));
  const docRows = await Promise.all(
    parsed.docs.map(async (d) => ({
      name: d.name,
      path: await saveFile(d.file, `docs/${property.id}`, "doc"),
    }))
  );
  await prisma.$transaction([
    prisma.propertyImage.createMany({ data: imagePaths.map((path) => ({ propertyId: property.id, path })) }),
    prisma.propertyDocument.createMany({ data: docRows.map((d) => ({ ...d, propertyId: property.id })) }),
  ]);

  return NextResponse.json({ id: property.id, status }, { status: 201 });
}
