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
  const fileErrors: Record<string, string> = {};
  if (!idFile) fileErrors.document = "Upload a photo or PDF of the person's ID.";
  if (Object.keys(fileErrors).length) return bad(fileErrors);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "An account with this email already exists.", fieldErrors: { email: "Already registered." } }, { status: 409 });
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name, email, role, createdById: me.id,
        passwordHash: await bcrypt.hash(password, 12),
        // Admin-created: treated as already verified — they only need to change the temporary password.
        emailVerifiedAt: new Date(),
        ownerProfile: {
          create: {
            accountType: "INDIVIDUAL",
            legalName: name,
            phone,
            idType: d.idType,
            idNumberMasked: maskIdNumber(d.idNumber!), // required by validateStep2 here, so never null
            addressLine1: d.addressLine1, addressLine2: d.addressLine2,
            city: d.city, state: d.state, postalCode: d.postalCode,
            // Created and vouched for by an admin: no onboarding wizard (relationship, consents) and no verification step.
            completedSteps: 3,
            onboardingCompletedAt: new Date(),
            verificationStatus: "VERIFIED",
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
  const stored: { type: "ID_DOCUMENT"; name: string; file: StoredSensitiveFile }[] = [];
  let failure: { field: string; error: string } | null = null;

  for (const [type, file, field] of [
    ["ID_DOCUMENT", idFile, "document"],
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
            fromStatus: "NONE", toStatus: "VERIFIED",
            note: `Created by ${me.name} (${me.role}) and verified on creation. Creator declared the ID document was collected with the person's consent.`,
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

  // Login details go to the new person's email. No email/KYC verification step — only change the temporary password after first sign-in.
  const loginUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/login` : null;
  const roleLabel = role === "PROPERTY_MANAGER" ? "Property Manager" : "Property Admin (co-owner)";
  await notify(
    email,
    "Your account has been created",
    `Hi ${name},\n\n${me.name} created a ${roleLabel} account for you.\n\n` +
      `Your login details:\nLogin ID (email): ${email}\nTemporary password: ${password}\n\n` +
      (loginUrl ? `Sign in here: ${loginUrl}\n\n` : "") +
      `You do not need to verify your account. After you sign in, open Profile and change this temporary password to one only you know. Do not share it with anyone.`
  );

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 });
}