import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { isAssignedManager, isVerifiedManager } from "@/lib/property-access";
import { checkFile, removeFile, saveFile } from "@/lib/uploads";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, notifyEmails } from "@/lib/issues";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MAX_PHOTOS = 3;

// A manager assigned to this property raises a ticket. It goes to whoever listed the property.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);
  if (me.role !== "PROPERTY_MANAGER") return fail("Only managers can raise issues.", 403);

  const { id: propertyId } = await params;
  if (!(await isAssignedManager(me.id, propertyId)) || !(await isVerifiedManager(me.id))) {
    return fail("You aren't assigned to this property.", 403);
  }

  const fd = await req.formData().catch(() => null);
  if (!fd) return fail("Invalid form data.");
  const str = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

  const category = str("category", 40);
  const title = str("title", 150);
  const description = str("description", 4000);
  const priority = str("priority", 10) || "MEDIUM";
  let roomId = str("roomId", 40) || null;
  const allocationId = str("allocationId", 40) || null;
  const neededByRaw = str("neededBy", 10);
  const recipientInput = str("recipientId", 40) || null;

  if (!CATEGORIES.includes(category as never)) return fail("Choose a category.");
  if (!title || !description) return fail("Add a title and a description.");
  if (!PRIORITIES.includes(priority as never)) return fail("Choose a priority.");
  let neededBy: Date | null = null;
  if (neededByRaw) {
    neededBy = new Date(`${neededByRaw}T00:00:00.000Z`);
    if (Number.isNaN(neededBy.getTime())) return fail("Enter a valid \"needed by\" date.");
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owner: { select: { email: true } }, coOwners: { select: { userId: true } } },
  });
  if (!property) return fail("Property not found.", 404);

  // Sent to the main owner unless the manager picked one of the property's co-owners
  const toId = recipientInput ?? property.ownerId;
  if (toId !== property.ownerId && !property.coOwners.some((c) => c.userId === toId)) return fail("Choose who to send this to.");
  const recipient = await prisma.user.findUnique({ where: { id: toId }, select: { email: true, role: true } });
  if (!recipient) return fail("Choose who to send this to.");

  if (roomId && !(await prisma.room.findFirst({ where: { id: roomId, propertyId }, select: { id: true } }))) {
    return fail("Choose a room from this property.");
  }
  if (allocationId) {
    const a = await prisma.allocation.findFirst({ where: { id: allocationId, room: { propertyId } }, select: { roomId: true } });
    if (!a) return fail("Choose a resident from this property.");
    roomId = roomId ?? a.roomId;
  }

  const photos = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) return fail(`Add up to ${MAX_PHOTOS} photos.`);
  for (const p of photos) {
    const err = checkFile(p, "image");
    if (err) return fail(err);
  }
  const images: string[] = [];
  for (const p of photos) images.push(await saveFile(p, "issues", "image"));

  let issue;
  try {
    issue = await prisma.issue.create({
      data: {
        propertyId, roomId, allocationId, reportedById: me.id, title, description,
        category: category as never, priority: priority as never, neededBy, images,
        recipientId: toId === property.ownerId ? null : toId,
        // a ticket sent to a Super Admin has no Property Admin in between
        escalatedAt: recipient.role === "SUPER_ADMIN" ? new Date() : null,
      },
      select: { id: true, ticketNo: true },
    });
  } catch {
    await Promise.all(images.map(removeFile));
    return fail("Could not raise the issue. Try again.", 500);
  }

  await notifyEmails(
    [recipient.email, property.owner.email],
    `New issue #${issue.ticketNo} at "${property.name}": ${title}`,
    `${me.name} raised an issue (${priority.toLowerCase()} priority, ${CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL]}):\n\n${title}\n\n${description}\n\nSign in and open Issues to respond.`
  );
  return NextResponse.json(issue, { status: 201 });
}
