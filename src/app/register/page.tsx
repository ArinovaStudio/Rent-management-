"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import {
  ID_TYPES, ID_TYPE_LABEL, RELATIONSHIPS, RELATIONSHIP_LABEL,
  validateRegister, validateStep1, validateStep2, validateStep3,
  type FieldErrors, type IdTypeValue, type AccountTypeValue,
} from "@/lib/owner-validation";
import { CONSENTS, POLICY_VERSIONS, type ConsentKey } from "@/lib/policies";

type ServerState = {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  profile: {
    accountType: AccountTypeValue; legalName: string; phone: string | null;
    idType: IdTypeValue | null; idNumberMasked: string | null;
    document: { id: string; name: string; sizeBytes: number } | null;
    addressProof: { id: string; name: string; sizeBytes: number } | null;
    addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null;
    companyRegistrationNumber: string | null; gstin: string | null; signatoryName: string | null; signatoryDesignation: string | null;
    propertyRelationship: string | null; authorityDetails: string | null;
    consents: Record<ConsentKey, boolean>;
    completedSteps: number; onboardingComplete: boolean;
  };
};

type Values = Record<string, string>;
const STEP_TITLES = ["Basic details", "Identity", "Property relationship"];
const MAX_DOC_MB = 10;
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function valuesFrom(s: ServerState | null): Values {
  const p = s?.profile;
  return {
    accountType: p?.accountType ?? "INDIVIDUAL", legalName: p?.legalName ?? "", phone: p?.phone ?? "",
    email: s?.email ?? "", password: "",
    idType: p?.idType ?? "AADHAAR", idNumber: "",
    addressLine1: p?.addressLine1 ?? "", addressLine2: p?.addressLine2 ?? "", city: p?.city ?? "", state: p?.state ?? "", postalCode: p?.postalCode ?? "",
    companyRegistrationNumber: p?.companyRegistrationNumber ?? "", gstin: p?.gstin ?? "",
    signatoryName: p?.signatoryName ?? "", signatoryDesignation: p?.signatoryDesignation ?? "",
    propertyRelationship: p?.propertyRelationship ?? "", authorityDetails: p?.authorityDetails ?? "",
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState<ServerState | null>(null); // null = not signed in yet
  const [step, setStep] = useState(1);
  const [v, setV] = useState<Values>(valuesFrom(null));
  const [file, setFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false, kyc: false, authority: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Loads the saved draft. Returns the state so callers can move to the right step.
  const load = useCallback(async (): Promise<ServerState | null> => {
    const res = await authFetch("/api/onboarding", {});
    if (res.status === 401) return null;
    const data = await res.json();
    if (data.legacy || data.profile?.onboardingComplete) { router.replace("/dashboard"); return null; }
    return data as ServerState;
  }, [router]);

  useEffect(() => {
    load()
      .then((s) => {
        if (s) {
          setServer(s);
          setV(valuesFrom(s));
          setConsents(s.profile.consents);
          // Resume on the first step that hasn't been saved. Google sign-ups start at step 1.
          // A draft saved before address proof was required goes back to step 2 to add it.
          const done = s.profile.completedSteps >= 2 && !s.profile.addressProof ? 1 : s.profile.completedSteps;
          setStep(Math.min(done + 1, 3));
        }
      })
      .catch(() => setFormError("Couldn't load your registration. Refresh to try again."))
      .finally(() => setLoading(false));
  }, [load]);

  // Move focus to the heading on step change, and to the first invalid field when validation fails.
  useEffect(() => { headingRef.current?.focus(); }, [step, loading]);
  useEffect(() => {
    if (Object.keys(errors).length) document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setV((old) => ({ ...old, [k]: e.target.value }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const field = (k: string) => ({
    name: k, value: v[k] ?? "", onChange: set(k),
    "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined,
  });
  const Err = ({ k }: { k: string }) => (errors[k] ? <span id={`${k}-err`} className="error" role="alert">{errors[k]}</span> : null);

  const isCompany = v.accountType === "COMPANY";
  const signedIn = !!server;
  const googleUser = signedIn && !server.hasPassword;

  async function send(url: string, init: RequestInit, method: "authFetch" | "fetch" = "authFetch") {
    setBusy(true); setFormError("");
    try {
      const res = method === "fetch" ? await fetch(url, init) : await authFetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        setFormError(res.status === 401 ? "Your session expired. Sign in to continue your registration." : body.error ?? "Something went wrong.");
        return false;
      }
      return true;
    } catch {
      setFormError("Network problem. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    const s = await load();
    if (s) { setServer(s); setConsents(s.profile.consents); setV((old) => ({ ...valuesFrom(s), password: "", idNumber: "", email: old.email })); }
    setFile(null); setErrors({});
    setStep((n) => n + 1);
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    const check = signedIn ? validateStep1(v) : validateRegister(v);
    if (!check.ok) return setErrors(check.fieldErrors);
    setErrors({});
    const json = { "Content-Type": "application/json" };
    const ok = signedIn
      ? await send("/api/onboarding/1", { method: "PUT", headers: json, body: JSON.stringify(v) })
      : await send("/api/auth/register", { method: "POST", headers: json, body: JSON.stringify(v) }, "fetch");
    if (ok) await advance();
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    const p = server!.profile;
    const check = validateStep2(v, { accountType: p.accountType, existingIdType: p.idType, hasExistingIdNumber: !!p.idNumberMasked });
    const errs: FieldErrors = check.ok ? {} : { ...check.fieldErrors };
    if (file) {
      if (!DOC_TYPES.includes(file.type)) errs.document = "Use a PDF, JPG, PNG or WebP file.";
      else if (file.size > MAX_DOC_MB * 1024 * 1024) errs.document = `File is larger than ${MAX_DOC_MB} MB.`;
    } else if (!p.document || v.idType !== p.idType) {
      errs.document = "Upload a photo or PDF of your ID.";
    }
    if (addressFile) {
      if (!DOC_TYPES.includes(addressFile.type)) errs.addressProof = "Use a PDF, JPG, PNG or WebP file.";
      else if (addressFile.size > MAX_DOC_MB * 1024 * 1024) errs.addressProof = `File is larger than ${MAX_DOC_MB} MB.`;
    } else if (!p.addressProof) {
      errs.addressProof = "Upload your address proof.";
    }
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    const fd = new FormData();
    for (const k of ["idType", "idNumber", "addressLine1", "addressLine2", "city", "state", "postalCode",
      "companyRegistrationNumber", "gstin", "signatoryName", "signatoryDesignation"]) fd.append(k, v[k] ?? "");
    if (file) fd.append("document", file);
    if (addressFile) fd.append("addressProof", addressFile);
    if (await send("/api/onboarding/2", { method: "PUT", body: fd })) await advance();
  }

  async function submitStep3(e: React.FormEvent) {
    e.preventDefault();
    // Send the policy version for every box that is ticked, as shown on this page
    const accepted = Object.fromEntries(CONSENTS.filter((c) => consents[c.key]).map((c) => [c.key, POLICY_VERSIONS[c.key]]));
    const payload = { propertyRelationship: v.propertyRelationship, authorityDetails: v.authorityDetails, consents: accepted };
    const check = validateStep3(payload);
    if (!check.ok) return setErrors(check.fieldErrors);
    setErrors({});
    const ok = await send("/api/onboarding/3", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (ok) router.push("/dashboard");
  }

  if (loading) return <main className="wizard"><p className="muted" role="status">Loading your registration…</p></main>;

  const p = server?.profile;
  const idHint = p?.idNumberMasked && p.idType === v.idType ? `On file: ${p.idNumberMasked}. Leave blank to keep it.` : undefined;

  return (
    <main className="wizard">
      <h1 ref={headingRef} tabIndex={-1}>{signedIn && step === 1 && p && p.completedSteps === 0 ? "Finish setting up your owner account" : "Create your owner account"}</h1>

      <ol className="stepper" aria-label="Registration progress">
        {STEP_TITLES.map((t, i) => (
          <li key={t} aria-current={step === i + 1 ? "step" : undefined} className={step > i + 1 ? "done" : step === i + 1 ? "current" : ""}>
            <span className="stepper-n">{step > i + 1 ? "✓" : i + 1}</span> {t}
          </li>
        ))}
      </ol>
      {signedIn && <p className="muted" style={{ marginTop: 0 }}>Your progress is saved. You can sign in later and carry on from here.</p>}
      {formError && <p className="error" role="alert">{formError} {formError.startsWith("Your session") && <a href="/login">Sign in</a>}</p>}

      {step === 1 && (
        <form onSubmit={submitStep1} noValidate>
          <fieldset>
            <legend>Account type</legend>
            <div className="choice-row">
              {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
                <label key={t} className="check">
                  <input type="radio" name="accountType" value={t} checked={v.accountType === t} onChange={set("accountType")} />
                  {t === "INDIVIDUAL" ? "Individual" : "Company"}
                </label>
              ))}
            </div>
            <Err k="accountType" />
          </fieldset>
          <label>{isCompany ? "Registered company name" : "Full legal name"}
            <input {...field("legalName")} autoComplete={isCompany ? "organization" : "name"} required />
            <Err k="legalName" />
          </label>
          {signedIn ? (
            <p className="muted" style={{ margin: 0 }}>Email: {server.email} {server.emailVerified && <span className="badge approved">Verified by Google</span>}</p>
          ) : (
            <label>Email
              <input {...field("email")} type="email" autoComplete="email" required />
              <Err k="email" />
            </label>
          )}
          <label>Mobile number
            <input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
            <span className="hint">We&apos;ll verify this number. 10-digit Indian mobile.</span>
            <Err k="phone" />
          </label>
          {!signedIn && (
            <label>Password
              <input {...field("password")} type="password" autoComplete="new-password" required />
              <span className="hint">8 to 72 characters.</span>
              <Err k="password" />
            </label>
          )}
          <button disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
          {!signedIn && (
            <>
              <p className="or">or</p>
              <a className="button secondary" href="/api/auth/google" style={{ display: "block" }}>Continue with Google</a>
              <p className="muted">Already have an account? <a href="/login">Sign in</a></p>
            </>
          )}
        </form>
      )}

      {step === 2 && p && (
        <form onSubmit={submitStep2} noValidate>
          {isCompany && (
            <fieldset>
              <legend>Company details</legend>
              <label>CIN / LLPIN
                <input {...field("companyRegistrationNumber")} autoComplete="off" required />
                <Err k="companyRegistrationNumber" />
              </label>
              <label>GSTIN (optional)
                <input {...field("gstin")} autoComplete="off" />
                <Err k="gstin" />
              </label>
              <div className="row">
                <label>Authorised signatory
                  <input {...field("signatoryName")} autoComplete="name" required />
                  <Err k="signatoryName" />
                </label>
                <label>Designation
                  <input {...field("signatoryDesignation")} placeholder="Director" required />
                  <Err k="signatoryDesignation" />
                </label>
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend>{isCompany ? "Signatory's ID" : "Your ID"}</legend>
            <label>ID type
              <select {...field("idType")}>
                {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
              </select>
              <Err k="idType" />
            </label>
            <label>ID number
              <input {...field("idNumber")} autoComplete="off" inputMode="text" />
              {idHint && <span className="hint">{idHint}</span>}
              <span className="hint">We keep only the last 4 characters. The full number isn&apos;t stored.</span>
              <Err k="idNumber" />
            </label>
            <label>ID document
              <input type="file" name="document" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                aria-invalid={errors.document ? true : undefined} aria-describedby={errors.document ? "document-err" : undefined}
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors(({ document: _d, ...r }) => r); }} />
              {p.document && !file && (
                <span className="hint">Uploaded: <a href={`/api/owner-documents/${p.document.id}`} target="_blank" rel="noreferrer">{p.document.name}</a>. Choose a file only to replace it.</span>
              )}
              <span className="hint">PDF, JPG, PNG or WebP, up to {MAX_DOC_MB} MB.</span>
              <Err k="document" />
            </label>
          </fieldset>
          <fieldset>
            <legend>{isCompany ? "Registered office address" : "Your address"}</legend>
            <label>Address line 1
              <input {...field("addressLine1")} autoComplete="address-line1" required />
              <Err k="addressLine1" />
            </label>
            <label>Address line 2 (optional)
              <input {...field("addressLine2")} autoComplete="address-line2" />
              <Err k="addressLine2" />
            </label>
            <div className="row">
              <label>City<input {...field("city")} autoComplete="address-level2" required /><Err k="city" /></label>
              <label>State<input {...field("state")} autoComplete="address-level1" required /><Err k="state" /></label>
              <label>PIN code<input {...field("postalCode")} inputMode="numeric" autoComplete="postal-code" required /><Err k="postalCode" /></label>
            </div>
            <label>Address proof
              <input type="file" name="addressProof" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                aria-invalid={errors.addressProof ? true : undefined} aria-describedby={errors.addressProof ? "addressProof-err" : undefined}
                onChange={(e) => { setAddressFile(e.target.files?.[0] ?? null); setErrors(({ addressProof: _a, ...r }) => r); }} />
              {p.addressProof && !addressFile && (
                <span className="hint">Uploaded: <a href={`/api/owner-documents/${p.addressProof.id}`} target="_blank" rel="noreferrer">{p.addressProof.name}</a>. Choose a file only to replace it.</span>
              )}
              <span className="hint">A utility bill, bank statement or rent agreement showing this address. PDF, JPG, PNG or WebP, up to {MAX_DOC_MB} MB.</span>
              <Err k="addressProof" />
            </label>
          </fieldset>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => { setErrors({}); setStep(1); }} disabled={busy}>Back</button>
            <button disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
          </div>
        </form>
      )}

      {step === 3 && p && (
        <form onSubmit={submitStep3} noValidate>
          <fieldset>
            <legend>Your relationship to the property</legend>
            {RELATIONSHIPS.map((r) => (
              <label key={r} className="check">
                <input type="radio" name="propertyRelationship" value={r} checked={v.propertyRelationship === r} onChange={set("propertyRelationship")}
                  aria-invalid={errors.propertyRelationship ? true : undefined} />
                {RELATIONSHIP_LABEL[r]}
              </label>
            ))}
            <Err k="propertyRelationship" />
            {v.propertyRelationship && v.propertyRelationship !== "OWNER" && (
              <label>What is your authority?
                <textarea {...field("authorityDetails")} rows={3} placeholder="For example: lease dated 1 March 2025 with the owner, valid until 2028." />
                <Err k="authorityDetails" />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>Consents</legend>
            {CONSENTS.map((c) => (
              <div key={c.key}>
                <label className="check">
                  <input type="checkbox" checked={consents[c.key]}
                    aria-invalid={errors[`consent_${c.key}`] ? true : undefined}
                    onChange={(e) => { setConsents((o) => ({ ...o, [c.key]: e.target.checked })); setErrors(({ [`consent_${c.key}`]: _c, ...r }) => r); }} />
                  <span>{c.label} {c.href && <a href={c.href} target="_blank" rel="noreferrer">Read</a>}</span>
                </label>
                <Err k={`consent_${c.key}`} />
              </div>
            ))}
          </fieldset>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => { setErrors({}); setStep(2); }} disabled={busy}>Back</button>
            <button disabled={busy}>{busy ? "Submitting…" : "Submit registration"}</button>
          </div>
        </form>
      )}
    </main>
  );
}
