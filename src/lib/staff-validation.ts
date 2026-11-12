import {
  isValidEmail, normalizeMobile, validatePassword, validateStep2,
  type FieldErrors, type Result, type Step2Data,
} from "./owner-validation";

export type StaffData = { name: string; email: string; password: string; phone: string; identity: Step2Data };

export function validateStaff(input: Record<string, unknown>): Result<StaffData> {
  const e: FieldErrors = {};

  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) e.name = "Enter the person's full legal name.";

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) e.email = "Enter a valid email address.";

  const password = typeof input.password === "string" ? input.password : "";
  const pw = validatePassword(password, email);
  if (pw) e.password = pw;

  const phone = normalizeMobile(String(input.phone ?? ""));
  if (!phone) e.phone = "Enter a valid 10-digit mobile number.";

  if (input.consentDeclared !== "on" && input.consentDeclared !== "true") {
    e.consentDeclared = "Confirm you collected these documents with the person's consent.";
  }

  const id = validateStep2(input, { accountType: "INDIVIDUAL", existingIdType: null, hasExistingIdNumber: false });
  if (!id.ok) Object.assign(e, id.fieldErrors);

  if (Object.keys(e).length || !id.ok) return { ok: false, fieldErrors: e };
  return { ok: true, data: { name, email, password, phone: phone!, identity: id.data } };
}