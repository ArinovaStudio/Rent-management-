import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { notify } from "@/lib/mailer";
import { removeSensitiveFile } from "@/lib/uploads";

async function guard(params: Promise<{ id: string }>) {
    const me = await getCurrentUser();
    if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
    const { id } = await params;
    const property = await prisma.property.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true } });
    if (!property || !canEditProperty(me, property)) {
        return { error: NextResponse.json({ error: "You can't manage this property." }, { status: 403 }) };
    }
    return { me, property };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const g = await guard(params);
    if ("error" in g) return g.error;

    const { email } = await req.json().catch(() => ({}));
    const address = String(email ?? "").trim().toLowerCase();
    const coOwner = address ? await prisma.user.findUnique({ where: { email: address }, select: { id: true, role: true, email: true } }) : null;
    const status = coOwner ? await getVerificationStatus(coOwner.id) : null;
    // One generic message for every failure, so this can't be used to probe which emails are registered
    if (!coOwner || coOwner.role !== "PROPERTY_ADMIN" || (g.me.role === "PROPERTY_ADMIN" && status !== null && status !== "VERIFIED")) {
        return NextResponse.json({ error: "No verified Property Admin was found with that email." }, { status: 400 });
    }
    if (coOwner.id === g.property.ownerId) {
        return NextResponse.json({ error: "The primary owner can't also be a co-owner." }, { status: 400 });
    }
    const existing = await prisma.propertyCoOwner.findUnique({
        where: { propertyId_userId: { propertyId: g.property.id, userId: coOwner.id } },
        select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "That person is already a co-owner." }, { status: 409 });

    await prisma.propertyCoOwner.create({ data: { propertyId: g.property.id, userId: coOwner.id, assignedById: g.me.id } });

    const who = (g.me as unknown as { name?: string }).name ?? "A Property Admin";
    await notify(
        coOwner.email,
        `You were added as co-owner of "${g.property.name}"`,
        `${who} added you as a co-owner. Sign in and open Properties to submit your co-owner proof documents.`
    );
    return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const g = await guard(params);
    if ("error" in g) return g.error;

    const { userId } = await req.json().catch(() => ({}));
    const row = await prisma.propertyCoOwner.findUnique({
        where: { propertyId_userId: { propertyId: g.property.id, userId: String(userId ?? "") } },
        include: { documents: { select: { path: true } } },
    });
    if (!row) return NextResponse.json({ error: "That co-owner was not found." }, { status: 404 });

    await prisma.propertyCoOwner.delete({ where: { id: row.id } }); // proof rows cascade
    await Promise.all(row.documents.map((d) => removeSensitiveFile(d.path)));
    
    return NextResponse.json({ ok: true });
}