import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { checkFile, saveFile } from "@/lib/uploads";
import { canOperateProperty } from "@/lib/property-access";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);

  const { id: propertyId } = await params;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || !(await canOperateProperty(me, property))) return fail("You can't manage this property.", 403);

  const fd = await req.formData().catch(() => null);
  if (!fd) return fail("Invalid form data.");

  const isPg = property.type === "PG";

  // PG: the admin picks a category (capacity + AC) and a floor. Apartments/flats: a unit (roomId).
  const roomId = String(fd.get("roomId") ?? "");
  const capacity = Number(fd.get("capacity"));
  const ac = String(fd.get("ac") ?? "") === "true";
  const floor = Number(fd.get("floor"));

  const fullName = String(fd.get("fullName") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const moveInDate = new Date(String(fd.get("moveInDate") ?? ""));
  const securityDeposit = Number(fd.get("securityDeposit") || 0);

  const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);

  if (!fullName || !phone || !Number.isFinite(moveInDate.getTime())) {
    return fail("Name, phone and a valid move-in date are required.");
  }
  if (isPg) {
    if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(floor)) return fail("Choose a room category and floor.");
  } else if (!roomId) {
    return fail("Choose a unit.");
  }
  if (!Number.isInteger(securityDeposit) || securityDeposit < 0) return fail("Enter a valid security deposit.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (files.length > 8) return fail("Upload a maximum of 8 documents.");
  for (const file of files) {
    const error = checkFile(file, "doc");
    if (error) return fail(error);
  }

  const accessToken = randomBytes(32).toString("hex");

  try {
    const allocation = await prisma.$transaction(
      async (tx) => {
        let room;
        if (isPg) {
          const candidates = await tx.room.findMany({
            where: { propertyId, capacity, ac, floor },
            include: { _count: { select: { allocations: { where: { status: "ACTIVE" } } } } },
            orderBy: { createdAt: "asc" },
          });
          if (candidates.length === 0) throw new Error("CATEGORY_NOT_FOUND");
          // Fill partly-used rooms first so beds don't get scattered across empty rooms.
          const open = candidates
            .filter((r) => r._count.allocations < r.capacity)
            .sort((a, b) => b._count.allocations - a._count.allocations);
          room = open[0];
          if (!room) throw new Error("CATEGORY_FULL");
        } else {
          const found = await tx.room.findFirst({
            where: { id: roomId, propertyId },
            include: { _count: { select: { allocations: { where: { status: "ACTIVE" } } } } },
          });
          if (!found) throw new Error("ROOM_NOT_FOUND");
          if (found._count.allocations >= found.capacity) throw new Error("ROOM_FULL");
          room = found;
        }

        const category = isPg ? `${room.capacity}-seater${room.ac ? " AC" : ""}` : roomCategoryLabel(property, room);

        return tx.allocation.create({
          data: {
            roomId: room.id,
            fullName,
            phone,
            email: email || null,
            moveInDate,
            monthlyRent: room.rent, // always the rent set for this category while creating the property
            securityDeposit,
            roomCategory: category,
            floorNumber: roomFloor(property, room),
            accessToken,
          },
          select: { id: true, accessToken: true, fullName: true },
        });
      },
      { isolationLevel: "Serializable" }
    );

    const documents = await Promise.all(
      files.map(async (file) => ({
        allocationId: allocation.id,
        name: file.name,
        path: await saveFile(file, `residents/${allocation.id}`, "doc"),
      }))
    );
    if (documents.length) await prisma.residentDocument.createMany({ data: documents });

    return NextResponse.json({ allocation, residentUrl: `/resident/${allocation.accessToken}` }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "CATEGORY_FULL") return fail("This category is full on that floor. Pick another category or floor.", 409);
    if (msg === "CATEGORY_NOT_FOUND") return fail("This category doesn't exist on that floor.");
    if (msg === "ROOM_FULL") return fail("This unit is already occupied.", 409);
    if (msg === "ROOM_NOT_FOUND") return fail("Choose a unit from this property.");
    return fail("Allocation failed. Please refresh and try again.", 409);
  }
}
