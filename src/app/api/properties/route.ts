import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { parsePropertyForm, MAX_IMAGES, imageOrder } from "@/lib/property-form";
import { saveFile, saveSensitiveFile, removeSensitiveFile } from "@/lib/uploads";
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
  const order = imageOrder(parsed.imageOrder, [], imagePaths.length);
  const videoPath = parsed.videoFile ? await saveFile(parsed.videoFile, "videos", "video") : null;
  const docRows = await Promise.all(
    parsed.docs.map(async (d) => ({
      name: d.name,
      path: await saveFile(d.file, `docs/${property.id}`, "doc"),
    }))
  );
  await prisma.$transaction([
    prisma.propertyImage.createMany({
      data: imagePaths.map((path, i) => ({ propertyId: property.id, path, sortOrder: order.indexOf(`new:${i}`) })),
    }),
    prisma.propertyDocument.createMany({ data: docRows.map((d) => ({ ...d, propertyId: property.id })) }),
    ...(videoPath ? [prisma.property.update({ where: { id: property.id }, data: { videoPath } })] : []),
  ]);

  return NextResponse.json({ id: property.id, status }, { status: 201 });
}
