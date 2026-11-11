// Policy versions and the exact consent wording shown at registration.
// Bump a version whenever the text of that policy changes materially. The server stores the
// version each owner accepted, so you can later find everyone who needs to re-consent.
export const POLICY_VERSIONS = {
  terms: "2026-11-01",
  privacy: "2026-11-01",
  kyc: "2026-11-01",
  authority: "2026-11-01",
} as const;

export type ConsentKey = keyof typeof POLICY_VERSIONS;

export const CONSENTS: { key: ConsentKey; label: string; href?: string }[] = [
  { key: "terms", label: "I accept the Terms of Service.", href: "/legal/terms" },
  { key: "privacy", label: "I have read the Privacy Policy.", href: "/legal/privacy" },
  {
    key: "kyc",
    label: "I consent to my identity details and documents being collected and verified for KYC.",
  },
  {
    key: "authority",
    label: "I declare that I am legally entitled to list and let the properties I add, and that the information I provide is true.",
  },
];
