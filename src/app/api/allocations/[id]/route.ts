
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
// import { canEditProperty } from "@/lib/permissions";
import { canOperateProperty } from "@/lib/property-access";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();

  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  const allocation = await prisma.allocation.findUnique({
    where: { id },
    include: {
      room: {
        include: { property: true },
      },
    },
  });

  if (!allocation) {
    return NextResponse.json(
      { error: "Allocation not found." },
      { status: 404 }
    );
  }

  if (!(await canOperateProperty(me, allocation.room.property))) {
    return NextResponse.json(
      { error: "You can't manage this allocation." },
      { status: 403 }
    );
  }

  if (allocation.status === "CHECKED_OUT") {
    return NextResponse.json(
      { error: "This resident has already checked out." },
      { status: 409 }
    );
  }

  await prisma.allocation.update({
    where: { id },
    data: { status: "CHECKED_OUT" },
  });

  return NextResponse.json({ ok: true });
}
