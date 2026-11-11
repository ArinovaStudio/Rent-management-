import type { OwnerProfile, SensitiveDocument, User } from "@prisma/client";
import { POLICY_VERSIONS } from "./policies";

type ProfileWithDocs = OwnerProfile & { documents: SensitiveDocument[] };

// What the wizard is allowed to see. Deliberately a whitelist: no file paths, no hashes.
export function toClientState(user: User, profile: ProfileWithDocs) {
  const idDoc = profile.documents.find((d) => d.type === "ID_DOCUMENT");
  const addressDoc = profile.documents.find((d) => d.type === "ADDRESS_PROOF");
  return {
    email: user.email,
    emailVerified: !!user.emailVerifiedAt,
    hasPassword: !!user.passwordHash,
    profile: {
      accountType: profile.accountType,
      legalName: profile.legalName,
      phone: profile.phone,
      idType: profile.idType,
      idNumberMasked: profile.idNumberMasked,
      document: idDoc
        ? { id: idDoc.id, name: idDoc.originalName, sizeBytes: idDoc.sizeBytes }
        : null,
      addressProof: addressDoc
        ? { id: addressDoc.id, name: addressDoc.originalName, sizeBytes: addressDoc.sizeBytes }
        : null,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      companyRegistrationNumber: profile.companyRegistrationNumber,
      gstin: profile.gstin,
      signatoryName: profile.signatoryName,
      signatoryDesignation: profile.signatoryDesignation,
      propertyRelationship: profile.propertyRelationship,
      authorityDetails: profile.authorityDetails,
      // Which consents are on file at the *current* policy version
      consents: {
        terms: profile.termsVersion === POLICY_VERSIONS.terms,
        privacy: profile.privacyVersion === POLICY_VERSIONS.privacy,
        kyc: profile.kycConsentVersion === POLICY_VERSIONS.kyc,
        authority: profile.authorityDeclarationVersion === POLICY_VERSIONS.authority,
      },
      completedSteps: profile.completedSteps,
      onboardingComplete: !!profile.onboardingCompletedAt,
      verificationStatus: profile.verificationStatus,
    },
  };
}

export const profileWithDocs = { documents: true } as const;
