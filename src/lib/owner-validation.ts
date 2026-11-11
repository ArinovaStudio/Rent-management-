// Pure validation for the owner onboarding wizard. No server-only imports, so the same rules run
// in the browser (instant feedback) and on the server (the real check).
import { CONSENTS, POLICY_VERSIONS, type ConsentKey } from "./policies";

export const ACCOUNT_TYPES = ["INDIVIDUAL", "COMPANY"] as const;
export const ID_TYPES = ["AADHAAR", "PAN", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE"] as const;
export const RELATIONSHIPS = ["OWNER", "CO_OWNER", "LEASEHOLDER", "POWER_OF_ATTORNEY", "AUTHORIZED_MANAGER"] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];
export type IdTypeValue = (typeof ID_TYPES)[number];
export type RelationshipValue = (typeof RELATIONSHIPS)[number];

export const ID_TYPE_LABEL: Record<IdTypeValue, string> = {
  AADHAAR: "Aadhaar",
  PAN: "PAN",
  PASSPORT: "Passport",
  VOTER_ID: "Voter ID",
  DRIVING_LICENSE: "Driving licence",
};

export const RELATIONSHIP_LABEL: Record<RelationshipValue, string> = {
  OWNER: "I am the owner",
  CO_OWNER: "I am a co-owner",
  LEASEHOLDER: "I am a leaseholder letting it onward",
  POWER_OF_ATTORNEY: "I hold power of attorney",
  AUTHORIZED_MANAGER: "I am an authorised manager or agent",
};

export type FieldErrors = Record<string, string>;
type Raw = Record<string, unknown>;
export type Result<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const collapse = (v: string) => v.replace(/\s+/g, " ");

// ---------- helpers ----------

// Indian mobile: 10 digits starting 6-9, optional +91 / 91 / 0 prefix. Returns E.164 or null.
export function normalizeMobile(input: string): string | null {
  let d = input.replace(/[\s\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// For now any non-empty ID number is accepted. Add per-type format checks here later.
export function checkIdNumber(_type: IdTypeValue, raw: string): { value: string } | { error: string } {
  const v = raw.replace(/\s/g, "").toUpperCase();
  return v ? { value: v } : { error: "Enter your ID number." };
}

// Keeps only the last 4 characters. The full number is never stored.
export const maskIdNumber = (clean: string) => "X".repeat(Math.max(clean.length - 4, 0)) + clean.slice(-4);

// ---------- Step 1 ----------

export type Step1Data = { accountType: AccountTypeValue; legalName: string; phone: string };
export type RegisterData = Step1Data & { email: string; password: string };

export function validateStep1(input: Raw): Result<Step1Data> {
  const e: FieldErrors = {};
  const accountType = str(input.accountType) as AccountTypeValue;
  if (!ACCOUNT_TYPES.includes(accountType)) e.accountType = "Choose Individual or Company.";

  const legalName = collapse(str(input.legalName));
  if (legalName.length < 2 || legalName.length > 120) {
    e.legalName = accountType === "COMPANY" ? "Enter the registered company name." : "Enter your full legal name.";
  }

  const phone = normalizeMobile(str(input.phone));
  if (!phone) e.phone = "Enter a valid 10-digit mobile number.";

  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return { ok: true, data: { accountType, legalName, phone: phone! } };
}

// bcrypt silently ignores everything past 72 bytes, so reject longer passwords.
export function validatePassword(password: string, email: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Use at most 72 characters.";
  if (password.toLowerCase() === email.toLowerCase()) return "Password can't be the same as your email.";
  return null;
}

export function validateRegister(input: Raw): Result<RegisterData> {
  const base = validateStep1(input);
  const e: FieldErrors = base.ok ? {} : { ...base.fieldErrors };
  const email = str(input.email).toLowerCase();
  if (!isValidEmail(email)) e.email = "Enter a valid email address.";
  const password = typeof input.password === "string" ? input.password : "";
  const pwError = validatePassword(password, email);
  if (pwError) e.password = pwError;
  if (Object.keys(e).length || !base.ok) return { ok: false, fieldErrors: e };
  return { ok: true, data: { ...base.data, email, password } };
}

// ---------- Step 2 ----------

export type Step2Data = {
  idType: IdTypeValue;
  idNumber: string | null; // cleaned; null means "keep the number already on file"
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  company: null | {
    companyRegistrationNumber: string;
    gstin: string | null;
    signatoryName: string;
    signatoryDesignation: string;
  };
};

export type Step2Context = {
  accountType: AccountTypeValue;
  existingIdType: IdTypeValue | null;
  hasExistingIdNumber: boolean;
};

export function validateStep2(input: Raw, ctx: Step2Context): Result<Step2Data> {
  const e: FieldErrors = {};
  const idType = str(input.idType) as IdTypeValue;
  if (!ID_TYPES.includes(idType)) e.idType = "Choose an ID type.";

  // Blank number is fine only when the same ID type already has one saved.
  let idNumber: string | null = null;
  const rawNumber = str(input.idNumber);
  const canKeep = ctx.hasExistingIdNumber && ctx.existingIdType === idType;
  if (rawNumber) {
    if (ID_TYPES.includes(idType)) {
      const r = checkIdNumber(idType, rawNumber);
      if ("error" in r) e.idNumber = r.error; else idNumber = r.value;
    }
  } else if (!canKeep) {
    e.idNumber = "Enter your ID number.";
  }

  const addressLine1 = collapse(str(input.addressLine1));
  const addressLine2 = collapse(str(input.addressLine2)) || null;
  const city = collapse(str(input.city));
  const state = collapse(str(input.state));
  const postalCode = str(input.postalCode).replace(/\s/g, "");
  if (addressLine1.length < 5 || addressLine1.length > 200) e.addressLine1 = "Enter your street address.";
  if (addressLine2 && addressLine2.length > 200) e.addressLine2 = "Keep this under 200 characters.";
  if (city.length < 2 || city.length > 80) e.city = "Enter your city.";
  if (state.length < 2 || state.length > 80) e.state = "Enter your state.";
  if (!/^[1-9]\d{5}$/.test(postalCode)) e.postalCode = "Enter a valid 6-digit PIN code.";

  let company: Step2Data["company"] = null;
  if (ctx.accountType === "COMPANY") {
    const reg = str(input.companyRegistrationNumber).toUpperCase().replace(/\s/g, "");
    const gstin = str(input.gstin).toUpperCase().replace(/\s/g, "");
    const signatoryName = collapse(str(input.signatoryName));
    const signatoryDesignation = collapse(str(input.signatoryDesignation));
    // Any input is accepted for now; stricter CIN/LLPIN/GSTIN checks can come later.
    if (!reg) e.companyRegistrationNumber = "Enter the company registration number.";
    if (signatoryName.length < 2 || signatoryName.length > 120) e.signatoryName = "Enter the authorised signatory's name.";
    if (signatoryDesignation.length < 2 || signatoryDesignation.length > 80) e.signatoryDesignation = "Enter their designation, like Director.";
    company = { companyRegistrationNumber: reg, gstin: gstin || null, signatoryName, signatoryDesignation };
  }

  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return { ok: true, data: { idType, idNumber, addressLine1, addressLine2, city, state, postalCode, company } };
}

// ---------- Step 3 ----------

export type Step3Data = {
  propertyRelationship: RelationshipValue;
  authorityDetails: string | null;
};

export function validateStep3(input: Raw): Result<Step3Data> {
  const e: FieldErrors = {};
  const rel = str(input.propertyRelationship) as RelationshipValue;
  if (!RELATIONSHIPS.includes(rel)) e.propertyRelationship = "Choose how you are related to the property.";

  // Anyone who isn't the owner has to say what their authority is.
  const details = str(input.authorityDetails);
  if (rel && rel !== "OWNER" && RELATIONSHIPS.includes(rel)) {
    if (details.length < 10) e.authorityDetails = "Briefly describe your authority, e.g. the lease or power-of-attorney reference.";
  }
  if (details.length > 1000) e.authorityDetails = "Keep this under 1000 characters.";

  // The client sends the policy versions it displayed; a mismatch means the text changed under them.
  const consents = (input.consents && typeof input.consents === "object" ? input.consents : {}) as Raw;
  for (const c of CONSENTS) {
    if (consents[c.key] !== POLICY_VERSIONS[c.key]) {
      e[`consent_${c.key}`] = consents[c.key] ? "This policy was updated. Reload and review it again." : "Required to continue.";
    }
  }

  if (Object.keys(e).length) return { ok: false, fieldErrors: e };
  return { ok: true, data: { propertyRelationship: rel, authorityDetails: rel === "OWNER" ? null : details } };
}

export type { ConsentKey };
