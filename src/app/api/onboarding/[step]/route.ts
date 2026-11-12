import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { POLICY_VERSIONS } from "@/lib/policies";
import { maskIdNumber, validateStep1, validateStep2, validateStep3 } from "@/lib/owner-validation";
import { removeSensitiveFile, saveSensitiveFile, type StoredSensitiveFile } from "@/lib/uploads";
import { syncVerificationStatus } from "@/lib/owner-status";

const bad = (fieldErrors: Record<string, string>, error = "Check the highlighted fields.") =>
  NextResponse.json({ error, fieldErrors }, { status: 400 });

// Saves one wizard step for the signed-in owner. Steps 1 and 3 send JSON, step 2 sends multipart
// (it carries the ID document). Each step can be re-saved until onboarding is submitted.
export async function PUT(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await prisma.ownerProfile.findUnique({ where: { userId: me.id }, include: { documents: true } });
  if (!profile) return NextResponse.json({ error: "No owner profile on this account." }, { status: 404 });
  if (profile.onboardingCompletedAt) {
    return NextResponse.json({ error: "Your registration has already been submitted." }, { status: 409 });
  }

  // ---- Step 1: basic details (Google sign-ups; email sign-ups saved this at POST /api/auth/register)
  if (step === "1") {
    const body = await req.json().catch(() => null);
    const parsed = validateStep1(body && typeof body === "object" ? body : {});
    if (!parsed.ok) return bad(parsed.fieldErrors);
    const { accountType, legalName, phone } = parsed.data;

    const typeChanged = accountType !== profile.accountType;
    await prisma.ownerProfile.update({
      where: { id: profile.id },
      data: {
        accountType,
        legalName,
        phone,
        // A different number has to be verified again
        ...(phone !== profile.phone ? { phoneVerifiedAt: null } : {}),
        // Switching Individual <-> Company changes what step 2 asks, so step 2 must be redone
        ...(typeChanged
          ? {
              completedSteps: 1,
              companyRegistrationNumber: null, gstin: null, signatoryName: null, signatoryDesignation: null,
            }
          : { completedSteps: Math.max(profile.completedSteps, 1) }),
      },
    });
    await prisma.user.update({ where: { id: me.id }, data: { name: legalName } });
    return NextResponse.json({ ok: true });
  }

  // ---- Step 2: identity
  if (step === "2") {
    if (profile.completedSteps < 1 || !profile.phone) {
      return NextResponse.json({ error: "Finish step 1 first." }, { status: 409 });
    }
    const fd = await req.formData().catch(() => null);
    if (!fd) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

    const raw: Record<string, unknown> = {};
    fd.forEach((v, k) => { if (typeof v === "string") raw[k] = v; });
    const parsed = validateStep2(raw, {
      accountType: profile.accountType,
      existingIdType: profile.idType,
      hasExistingIdNumber: !!profile.idNumberMasked,
    });
    if (!parsed.ok) return bad(parsed.fieldErrors);
    const d = parsed.data;

    const existingId = profile.documents.find((x) => x.type === "ID_DOCUMENT");
    const existingAddress = profile.documents.find((x) => x.type === "ADDRESS_PROOF");
    const pick = (name: string) => {
      const u = fd.get(name);
      return u instanceof File && u.size > 0 ? u : null;
    };
    const idFile = pick("document");
    const addressFile = pick("addressProof");

    // Both documents are required. Keeping the ID on file is only OK if the ID type didn't change.
    const errs: Record<string, string> = {};
    if (!idFile && (!existingId || d.idType !== profile.idType)) {
      errs.document = existingId ? "Upload a document for the new ID type." : "Upload a photo or PDF of your ID.";
    }
    if (!addressFile && !existingAddress) errs.addressProof = "Upload your address proof (PDF, JPG, PNG or WebP).";
    if (Object.keys(errs).length) return bad(errs);

    // Validate and store both files. If either is rejected, nothing is left behind.
    const uploads = [
      { type: "ID_DOCUMENT" as const, file: idFile, existing: existingId, field: "document" },
      { type: "ADDRESS_PROOF" as const, file: addressFile, existing: existingAddress, field: "addressProof" },
    ];
    const saved: { type: "ID_DOCUMENT" | "ADDRESS_PROOF"; existing?: { id: string; path: string }; originalName: string; stored: StoredSensitiveFile }[] = [];
    for (const u of uploads) {
      if (!u.file) continue;
      const r = await saveSensitiveFile(u.file, `owners/${profile.id}`);
      if ("error" in r) {
        await Promise.all(saved.map((x) => removeSensitiveFile(x.stored.path)));
        return bad({ [u.field]: r.error });
      }
      saved.push({ type: u.type, existing: u.existing, originalName: u.file.name.slice(0, 200), stored: r });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.ownerProfile.update({
          where: { id: profile.id },
          data: {
            idType: d.idType,
            // Only the masked form is saved, and only when a new number was typed
            ...(d.idNumber ? { idNumberMasked: maskIdNumber(d.idNumber) } : {}),
            addressLine1: d.addressLine1,
            addressLine2: d.addressLine2,
            city: d.city,
            state: d.state,
            postalCode: d.postalCode,
            companyRegistrationNumber: d.company?.companyRegistrationNumber ?? null,
            gstin: d.company?.gstin ?? null,
            signatoryName: d.company?.signatoryName ?? null,
            signatoryDesignation: d.company?.signatoryDesignation ?? null,
            completedSteps: Math.max(profile.completedSteps, 2),
          },
        });
        for (const x of saved) {
          await tx.sensitiveDocument.create({
            data: {
              ownerProfileId: profile.id,
              type: x.type,
              path: x.stored.path,
              originalName: x.originalName,
              mimeType: x.stored.mimeType,
              sizeBytes: x.stored.sizeBytes,
              sha256: x.stored.sha256,
            },
          });
          if (x.existing) await tx.sensitiveDocument.delete({ where: { id: x.existing.id } });
        }
      });
    } catch (err) {
      await Promise.all(saved.map((x) => removeSensitiveFile(x.stored.path)));
      throw err;
    }
    // Replaced files are only removed once the database change has committed
    await Promise.all(saved.filter((x) => x.existing).map((x) => removeSensitiveFile(x.existing!.path)));
    return NextResponse.json({ ok: true });
  }

  // ---- Step 3: property relationship, authority declaration, consents. Submits onboarding.
  if (step === "3") {
    if (profile.completedSteps < 2) return NextResponse.json({ error: "Finish step 2 first." }, { status: 409 });
    const types = new Set(profile.documents.map((x) => x.type));
    if (!types.has("ID_DOCUMENT") || !types.has("ADDRESS_PROOF")) {
      return NextResponse.json({ error: "Go back to step 2 and upload your ID document and address proof." }, { status: 409 });
    }
    const rawBody = await req.json().catch(() => null);
    const body: Record<string, unknown> = rawBody && typeof rawBody === "object" ? { ...rawBody } : {};
    // Managers don't choose a relationship: they act for the owner on their admin's appointment.
    if (me.role === "PROPERTY_MANAGER") {
      const u = await prisma.user.findUnique({ where: { id: me.id }, select: { createdById: true } });
      const creator = u?.createdById
        ? await prisma.user.findUnique({ where: { id: u.createdById }, select: { name: true } })
        : null;
      body.propertyRelationship = "AUTHORIZED_MANAGER";
      body.authorityDetails = `Appointed as property manager by ${creator?.name ?? "the property admin"}.`;
    }
    const parsed = validateStep3(body);
    if (!parsed.ok) return bad(parsed.fieldErrors);

    // Timestamps come from the server clock, versions from the server's current policy set.
    const now = new Date();
    await prisma.ownerProfile.update({
      where: { id: profile.id },
      data: {
        propertyRelationship: parsed.data.propertyRelationship,
        authorityDetails: parsed.data.authorityDetails,
        termsAcceptedAt: now, termsVersion: POLICY_VERSIONS.terms,
        privacyAcceptedAt: now, privacyVersion: POLICY_VERSIONS.privacy,
        kycConsentAt: now, kycConsentVersion: POLICY_VERSIONS.kyc,
        authorityDeclaredAt: now, authorityDeclarationVersion: POLICY_VERSIONS.authority,
        completedSteps: 3,
        onboardingCompletedAt: now,
      },
    });
    await syncVerificationStatus(me.id);
    return NextResponse.json({ ok: true, done: true });
  }

  return NextResponse.json({ error: "Unknown step." }, { status: 404 });
}
