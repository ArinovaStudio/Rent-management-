import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { checkFile, saveFile } from "@/lib/uploads";
import { canOperateProperty } from "@/lib/property-access";
import { roomFloor } from "@/lib/room-category";
import { notify } from "@/lib/mailer";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const TYPE_LABEL: Record<string, string> = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" };

// Welcome email with the private resident link and a short property summary. Best effort: never fails the allocation.
async function emailTenantWelcome(opts: {
  to: string;
  fullName: string;
  property: { name: string; type: string; address: string; city: string; sharing: boolean };
  links: { label: string; url: string; rent: number }[];
  moveInDate: Date;
  origin: string;
}) {
  const { to, fullName, property: p, links, moveInDate, origin } = opts;
  if (!to || links.length === 0) return;
  const type = `${TYPE_LABEL[p.type] ?? p.type}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`;
  const moveIn = moveInDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const linkLines =
    links.length === 1
      ? [`Your private resident link (use this to see rent, bills and documents):`, `${origin}${links[0].url}`]
      : [
          "Your private resident links (one per flat — use these to see rent, bills and documents):",
          ...links.flatMap((l) => [`· ${l.label}: ${origin}${l.url}`]),
        ];
  const unitLines = links.map((l) => `· ${l.label}${l.rent > 0 ? ` · ${inr(l.rent)} / month` : ""}`);
  const lines = [
    `Hi ${fullName},`,
    "",
    `You have been allocated as a tenant at ${p.name}. Keep this email — it has your private link and the key details.`,
    "",
    ...linkLines,
    "",
    "Property details",
    `Name: ${p.name}`,
    `Type: ${type}`,
    `Address: ${p.address}, ${p.city}`,
    `Move-in date: ${moveIn}`,
    ...(unitLines.length ? ["", "Your allocation", ...unitLines] : []),
    "",
    "If you were not expecting this, contact the property owner or manager.",
  ];
  await notify(to, `Welcome to ${p.name} — your resident link`, lines.join("\n"));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);

  const { id: propertyId } = await params;
  // Auth + welcome email + roomFloor only need these columns — not the full property row.
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true, ownerId: true, isActive: true, type: true, sharing: true, floors: true,
      name: true, address: true, city: true,
    },
  });
  if (!property || !(await canOperateProperty(me, property))) return fail("You can't manage this property.", 403);

  if (!property.isActive) return fail("This property is marked inactive (for example under construction). Switch it On before allocating residents.");
  // Local copy so nested helpers keep the narrowed type (TS doesn't retain narrowing in closures).
  const prop = property;
  const emailProperty = { name: prop.name, type: prop.type, address: prop.address, city: prop.city, sharing: prop.sharing };

  const fd = await req.formData().catch(() => null);
  if (!fd) return fail("Invalid form data.");

  const isPg = prop.type === "PG";
  const isBuilding = prop.type === "BUILDING";
  // PG and flats rented room by room: the admin picks a category (capacity + AC), and a floor for PGs.
  // A flat rented as a whole goes to one tenant, with the number of people who will live in it.
  const byCategory = isPg || (prop.sharing && !isBuilding);
  const capacity = Number(fd.get("capacity"));
  const ac = String(fd.get("ac") ?? "") === "true";
  const floor = Number(fd.get("floor"));

  const fullName = String(fd.get("fullName") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const moveInDate = new Date(String(fd.get("moveInDate") ?? ""));
  const securityDeposit = Number(fd.get("securityDeposit") || 0);

  const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);

  if (!fullName || !phone || !email || !Number.isFinite(moveInDate.getTime())) {
    return fail("Name, phone, email and a valid move-in date are required.");
  }
  if (byCategory) {
    if (!Number.isInteger(capacity) || capacity < 1) return fail("Choose a room category.");
    if (isPg && !Number.isInteger(floor)) return fail("Choose a floor.");
  }
  if (!Number.isInteger(securityDeposit) || securityDeposit < 0) return fail("Enter a valid security deposit.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (files.length > 8) return fail("Upload a maximum of 8 documents.");
  for (const file of files) {
    const error = checkFile(file, "doc");
    if (error) return fail(error);
  }

  // Building: one person can take several flats at once. Every flat gets its own allocation.
  // A single flat must be vacant. A shareable flat has no people limit: the first person pays the flat's rent,
  // everyone added later (or listed as a resident) is a housemate: own details, rent covered (₹0), no link of their own.
  async function allocateBuilding() {
    let flatsIn: { roomId: string; residents: { fullName: string; phone: string; email: string }[] }[] = [];
    try { const v = JSON.parse(String(fd?.get("flats") ?? "[]")); flatsIn = Array.isArray(v) ? v : []; } catch { /* handled below */ }
    if (flatsIn.length === 0 || flatsIn.length > 50) return fail("Select at least one flat.");
    const ids = flatsIn.map((f) => String(f.roomId));
    if (new Set(ids).size !== ids.length) return fail("A flat was selected twice.");
    for (const f of flatsIn) {
      const rs = Array.isArray(f.residents) ? f.residents : [];
      f.residents = rs.slice(0, 100).map((r) => ({ fullName: String(r.fullName ?? "").trim(), phone: String(r.phone ?? "").trim(), email: String(r.email ?? "").trim().toLowerCase() }));
      if (f.residents.some((r) => !r.fullName || !r.phone || (r.email && !/^\S+@\S+\.\S+$/.test(r.email)))) return fail("Every added resident needs a name and phone (and a valid email if given).");
    }
    try {
      const created = await prisma.$transaction(async (tx) => {
        const rooms = await tx.room.findMany({
          where: { propertyId, id: { in: ids }, isActive: true },
          select: {
            id: true, label: true, rent: true, roomType: true, floor: true, bedrooms: true,
            allocations: { where: { status: "ACTIVE" }, select: { isHousemate: true } },
          },
        });
        if (rooms.length !== ids.length) throw new Error("ROOM_NOT_FOUND");
        const out: { id: string; accessToken: string; fullName: string; flat: string; primary: boolean; main: boolean; rent: number }[] = [];
        for (const f of flatsIn) {
          const room = rooms.find((r) => r.id === f.roomId)!;
          const shareable = room.roomType === "SHAREABLE";
          if (!shareable && room.allocations.length > 0) throw new Error(`FLAT_TAKEN:${room.label}`);
          if (!shareable && f.residents.length > 0) throw new Error("NOT_SHAREABLE");
          // The first person in a flat is its main tenant (rent, bills, one link). Anyone added later shares that link.
          const hasMain = room.allocations.some((a) => !a.isHousemate);
          const category = shareable ? "Shareable flat" : "Single flat";
          const base = { roomId: room.id, moveInDate, occupants: 1, roomCategory: category, floorNumber: room.floor, roomLabel: room.label, roomBhk: room.bedrooms };
          const rent = hasMain ? 0 : room.rent;
          const tenant = await tx.allocation.create({
            data: { ...base, fullName, phone, email, monthlyRent: rent, securityDeposit: hasMain ? 0 : securityDeposit, isHousemate: hasMain, accessToken: randomBytes(32).toString("hex") },
            select: { id: true, accessToken: true, fullName: true },
          });
          out.push({ ...tenant, flat: room.label, primary: true, main: !hasMain, rent });
          for (const r of f.residents) {
            const a = await tx.allocation.create({
              data: { ...base, fullName: r.fullName, phone: r.phone, email: r.email || null, monthlyRent: 0, securityDeposit: 0, isHousemate: true, accessToken: randomBytes(32).toString("hex") },
              select: { id: true, accessToken: true, fullName: true },
            });
            out.push({ ...a, flat: room.label, primary: false, main: false, rent: 0 });
          }
        }
        return { out };
      }, { isolationLevel: "Serializable" });

      // Documents belong to the person being allocated, once per flat
      if (files.length) {
        for (const t of created.out.filter((a) => a.primary)) {
          const docs = await Promise.all(files.map(async (file) => ({ allocationId: t.id, name: file.name, path: await saveFile(file, `residents/${t.id}`, "doc") })));
          await prisma.residentDocument.createMany({ data: docs });
        }
      }
      const mains = created.out.filter((a) => a.main);
      const origin = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
      await emailTenantWelcome({
        to: email,
        fullName,
        property: emailProperty,
        links: mains.map((a) => ({ label: a.flat, url: `/resident/${a.accessToken}`, rent: a.rent })),
        moveInDate,
        origin,
      });
      return NextResponse.json({ links: mains.map((a) => ({ name: a.fullName, flat: a.flat, url: `/resident/${a.accessToken}` })) }, { status: 201 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.startsWith("FLAT_TAKEN:")) return fail(`${msg.slice(11)} is already rented. Refresh and pick another flat.`, 409);
      if (msg === "ROOM_NOT_FOUND") return fail("One of the selected flats doesn't exist.");
      if (msg === "NOT_SHAREABLE") return fail("A single flat holds one tenant. Mark it shareable to add more residents.");
      return fail("Allocation failed. Please refresh and try again.", 409);
    }
  }
  if (isBuilding) return allocateBuilding();

  const accessToken = randomBytes(32).toString("hex");

  try {
    const allocation = await prisma.$transaction(
      async (tx) => {
        let room;
        let rentToPay = 0;
        let isHousemate = false;
        if (byCategory) {
          const candidates = await tx.room.findMany({
            where: { propertyId, isActive: true, capacity, ac, ...(isPg ? { floor } : {}) },
            select: {
              id: true, rent: true, capacity: true, ac: true, label: true, bedrooms: true, floor: true, roomType: true,
              _count: { select: { allocations: { where: { status: "ACTIVE" } } } },
            },
            orderBy: { createdAt: "asc" },
          });
          if (candidates.length === 0) throw new Error("CATEGORY_NOT_FOUND");
          // Fill partly-used rooms first so beds don't get scattered across empty rooms.
          const open = candidates
            .filter((r) => r._count.allocations < r.capacity)
            .sort((a, b) => b._count.allocations - a._count.allocations);
          room = open[0];
          if (!room) throw new Error("CATEGORY_FULL");
          rentToPay = room.rent;
        } else {
          // Whole flat: one unit holding up to `capacity` people. Every person is stored with their own details.
          // The first person is the tenant who pays the rent; later people are housemates (rent covered, ₹0).
          const units = await tx.room.findMany({
            where: { propertyId, isActive: true },
            select: {
              id: true, rent: true, capacity: true, ac: true, label: true, bedrooms: true, floor: true, roomType: true,
              _count: { select: { allocations: { where: { status: "ACTIVE" } } } },
            },
            orderBy: { createdAt: "asc" },
          });
          if (units.length === 0) throw new Error("ROOM_NOT_FOUND");
          room = units[0];
          // A shared flat has no people limit; a flat for one tenant is full once rented.
          const sharedFlat = room.roomType === "SHAREABLE" || room.capacity > 1;
          if (!sharedFlat && room._count.allocations >= 1) throw new Error("ROOM_FULL");
          // First person is the main tenant (rent, bills, one link). Anyone added later shares that link.
          const mains = await tx.allocation.count({ where: { roomId: room.id, status: "ACTIVE", isHousemate: false } });
          isHousemate = mains > 0;
          rentToPay = isHousemate ? 0 : room.rent;
        }

        const category = isPg
          ? `${room.capacity}-seater${room.ac ? " AC" : ""}`
          : prop.sharing
            ? `${room.capacity}-sharing${room.ac ? " AC" : ""}`
            : "Entire flat";

        return tx.allocation.create({
          data: {
            roomId: room.id,
            fullName,
            phone,
            email,
            moveInDate,
            occupants: 1,
            monthlyRent: rentToPay, // always the rent set for this category (or the whole flat) while creating the property
            securityDeposit: isHousemate ? 0 : securityDeposit,
            isHousemate,
            roomCategory: category,
            roomLabel: room.label,
            roomBhk: room.bedrooms,
            floorNumber: roomFloor(prop, room),
            accessToken,
          },
          select: { id: true, accessToken: true, fullName: true, isHousemate: true, monthlyRent: true, roomCategory: true, roomLabel: true },
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

    if (!allocation.isHousemate) {
      const origin = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
      const unit = allocation.roomLabel ?? allocation.roomCategory ?? "Unit";
      await emailTenantWelcome({
        to: email,
        fullName,
        property: emailProperty,
        links: [{ label: unit, url: `/resident/${allocation.accessToken}`, rent: allocation.monthlyRent }],
        moveInDate,
        origin,
      });
    }

    return NextResponse.json({ allocation, housemate: allocation.isHousemate, residentUrl: allocation.isHousemate ? null : `/resident/${allocation.accessToken}` }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "CATEGORY_FULL") return fail("This category is full on that floor. Pick another category or floor.", 409);
    if (msg === "CATEGORY_NOT_FOUND") return fail("This category doesn't exist on that floor.");
    if (msg === "ROOM_FULL") return fail("This flat is already rented.", 409);
    if (msg === "ROOM_NOT_FOUND") return fail("This property has no unit to allocate.");
    if (msg === "TOO_MANY_PEOPLE") return fail("That is more people than this flat holds.");
    return fail("Allocation failed. Please refresh and try again.", 409);
  }
}
