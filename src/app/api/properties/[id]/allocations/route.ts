
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { checkFile, saveFile } from "@/lib/uploads";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();

  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property || !canEditProperty(me, property)) {
    return NextResponse.json(
      { error: "You can't manage this property." },
      { status: 403 }
    );
  }

  const fd = await req.formData().catch(() => null);

  if (!fd) {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 }
    );
  }

  const roomId = String(fd.get("roomId") ?? "");
  const fullName = String(fd.get("fullName") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();

  const moveInDate = new Date(String(fd.get("moveInDate") ?? ""));
  const monthlyRent = Number(fd.get("monthlyRent"));
  const securityDeposit = Number(fd.get("securityDeposit") || 0);

  const files = fd.getAll("documents").filter(
    (f): f is File => f instanceof File && f.size > 0
  );

  if (!roomId || !fullName || !phone || !Number.isFinite(moveInDate.getTime())) {
    return NextResponse.json(
      { error: "Name, phone, room and a valid move-in date are required." },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(monthlyRent) ||
    monthlyRent < 0 ||
    !Number.isInteger(securityDeposit) ||
    securityDeposit < 0
  ) {
    return NextResponse.json(
      { error: "Enter valid rent and security deposit amounts." },
      { status: 400 }
    );
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  if (files.length > 8) {
    return NextResponse.json(
      { error: "Upload a maximum of 8 documents." },
      { status: 400 }
    );
  }

  for (const file of files) {
    const error = checkFile(file, "doc");

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
  }

  const accessToken = randomBytes(32).toString("hex");

  try {
    const allocation = await prisma.$transaction(
      async (tx) => {
        const room = await tx.room.findFirst({
          where: { id: roomId, propertyId },
        });

        if (!room) throw new Error("ROOM_NOT_FOUND");

        const activeCount = await tx.allocation.count({
          where: {
            roomId,
            status: "ACTIVE",
          },
        });

        if (activeCount >= room.capacity) {
          throw new Error("ROOM_FULL");
        }

        return tx.allocation.create({
          data: {
            roomId,
            fullName,
            phone,
            email: email || null,
            moveInDate,
            monthlyRent,
            securityDeposit,
            accessToken,
          },
          select: {
            id: true,
            accessToken: true,
            fullName: true,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );

    const documents = await Promise.all(
      files.map(async (file) => ({
        allocationId: allocation.id,
        name: file.name,
        path: await saveFile(
          file,
          `residents/${allocation.id}`,
          "doc"
        ),
      }))
    );

    if (documents.length) {
      await prisma.residentDocument.createMany({
        data: documents,
      });
    }

    return NextResponse.json(
      {
        allocation,
        residentUrl: `/resident/${allocation.accessToken}`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_FULL") {
      return NextResponse.json(
        { error: "This room is full. Choose another room." },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") {
      return NextResponse.json(
        { error: "Choose a room from this property." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Allocation failed. Please refresh and try again." },
      { status: 409 }
    );
  }
}
