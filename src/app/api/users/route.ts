import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { CAN_CREATE } from "@/lib/permissions";
import type { Role } from "@/lib/jwt";
import { maskIdNumber } from "@/lib/owner-validation";
import { validateStaff } from "@/lib/staff-validation";
import { removeSensitiveFile, saveSensitiveFile, type StoredSensitiveFile } from "@/lib/uploads";
import { notify } from "@/lib/mailer";

const bad = (fieldErrors: Record<string, string>, status = 400) =>
  NextResponse.json({ error: "Check the highlighted fields.", fieldErrors }, { status });

// Creates a Property Admin (Super Admin only) or a Property Manager (Property Admin only),
// together with the identity details and documents we hold against them. Multipart form.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const role = String(fd.get("role") ?? "") as Role;
  if (!CAN_CREATE[me.role].includes(role)) {
    return NextResponse.json({ error: "You can't create this type of account." }, { status: 403 });
  }

  const raw: Record<string, unknown> = {};
  fd.forEach((v, k) => { if (typeof v === "string") raw[k] = v; });
  const parsed = validateStaff(raw);
  if (!parsed.ok) return bad(parsed.fieldErrors);
  const { name, email, password, phone, identity: d } = parsed.data;

  const pick = (field: string) => {
    const u = fd.get(field);
    return u instanceof File && u.size > 0 ? u : null;
  };
  const idFile = pick("document");
  const addressFile = pick("addressProof");
  const fileErrors: Record<string, string> = {};
  if (!idFile) fileErrors.document = "Upload a photo or PDF of the person's ID.";
  if (!addressFile) fileErrors.addressProof = "Upload the person's address proof.";
  if (Object.keys(fileErrors).length) return bad(fileErrors);

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "An account with this email already exists.", fieldErrors: { email: "Already registered." } }, { status: 409 });
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name, email, role, createdById: me.id,
        passwordHash: await bcrypt.hash(password, 12),
        ownerProfile: {
          create: {
            accountType: "INDIVIDUAL",
            legalName: name,
            phone,
            idType: d.idType,
            idNumberMasked: maskIdNumber(d.idNumber!), // required by validateStep2 here, so never null
            addressLine1: d.addressLine1, addressLine2: d.addressLine2,
            city: d.city, state: d.state, postalCode: d.postalCode,
            completedSteps: 2, // the person completes step 3 (relationship and consents) themselves on first login
          },
        },
      },
      select: { id: true, name: true, email: true, role: true, ownerProfile: { select: { id: true } } },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    throw err;
  }

  // Store the files. If anything fails, remove the account again so nothing half-created remains.
  const profileId = user.ownerProfile!.id;
  const stored: { type: "ID_DOCUMENT" | "ADDRESS_PROOF"; name: string; file: StoredSensitiveFile }[] = [];
  let failure: { field: string; error: string } | null = null;

  for (const [type, file, field] of [
    ["ID_DOCUMENT", idFile, "document"],
    ["ADDRESS_PROOF", addressFile, "addressProof"],
  ] as const) {
    if (!file) continue;
    const r = await saveSensitiveFile(file, `owners/${profileId}`);
    if ("error" in r) { failure = { field, error: r.error }; break; }
    stored.push({ type, name: file.name.slice(0, 200), file: r });
  }

  if (!failure) {
    try {
      await prisma.$transaction([
        prisma.sensitiveDocument.createMany({
          data: stored.map((s) => ({
            ownerProfileId: profileId, type: s.type, path: s.file.path, originalName: s.name,
            mimeType: s.file.mimeType, sizeBytes: s.file.sizeBytes, sha256: s.file.sha256,
          })),
        }),
        prisma.auditEvent.create({
          data: {
            subjectType: "OWNER_KYC", subjectId: profileId, actorId: me.id, action: "CREATE",
            fromStatus: "NONE", toStatus: "CONTACT_PENDING",
            note: `Created by ${me.name} (${me.role}). Creator declared the documents were collected with the person's consent.`,
          },
        }),
      ]);
    } catch {
      failure = { field: "document", error: "Couldn't save the documents. Try again." };
    }
  }

  if (failure) {
    await prisma.user.delete({ where: { id: user.id } }); // cascades the profile and document rows
    await Promise.all(stored.map((s) => removeSensitiveFile(s.file.path)));
    return bad({ [failure.field]: failure.error });
  }

  await notify(
    email,
    "Your account has been created",
    `Hi ${name},\n\n${me.name} created a ${role === "PROPERTY_MANAGER" ? "Property Manager" : "Property Admin"} account for you.\n\nSign in with the temporary password you were given, verify your email on your dashboard, and your account will then go for verification.`
  );

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 });
}