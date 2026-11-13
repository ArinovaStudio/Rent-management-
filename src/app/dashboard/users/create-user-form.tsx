"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/owner-validation";
import { F, FileDrop, Section, ToggleRow } from "@/app/dashboard/properties/property-sections";

const LABEL: Record<string, string> = { PROPERTY_ADMIN: "Property Admin", PROPERTY_MANAGER: "Property Manager" };
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export default function CreateUserForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fe = (k: string) => fieldErrors[k] && <span role="alert" className="text-xs text-destructive sm:col-span-2">{fieldErrors[k]}</span>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setFieldErrors({});
    const res = await authFetch("/api/users", { method: "POST", body: new FormData(form) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setFieldErrors(body.fieldErrors ?? {});
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section id="account" title="Account">
        <F label="Role">
          <select className="field" name="role" defaultValue={roles[0]} required>
            {roles.map((r) => <option key={r} value={r}>{LABEL[r] ?? r}</option>)}
          </select>
        </F>
        <F label="Full legal name"><input className="field" name="name" required />{fe("name")}</F>
        <F label="Email"><input className="field" name="email" type="email" required />{fe("email")}</F>
        <F label="Mobile number"><input className="field" name="phone" type="tel" required />{fe("phone")}</F>
        <F label="Temporary password"><input className="field" name="password" type="password" minLength={8} required />{fe("password")}</F>
      </Section>

      <Section id="identity" title="Identity & address" hint="Only the last 4 characters of the ID number are stored. Documents are kept privately.">
        <F label="ID type">
          <select className="field" name="idType" defaultValue="PAN" required>
            {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
          </select>
          {fe("idType")}
        </F>
        <F label="ID number"><input className="field" name="idNumber" required />{fe("idNumber")}</F>
        <FileDrop name="document" accept={ACCEPT} title="Upload ID photo or PDF" hint="JPG, PNG, WebP or PDF, up to 10 MB" />
        {fe("document")}
        <F label="Street address" wide><input className="field" name="addressLine1" required />{fe("addressLine1")}</F>
        <F label="Address line 2 (optional)" wide><input className="field" name="addressLine2" />{fe("addressLine2")}</F>
        <F label="City"><input className="field" name="city" required />{fe("city")}</F>
        <F label="State"><input className="field" name="state" required />{fe("state")}</F>
        <F label="PIN code"><input className="field" name="postalCode" inputMode="numeric" required />{fe("postalCode")}</F>
        <FileDrop name="addressProof" accept={ACCEPT} title="Upload address proof" hint="Utility bill, bank statement, etc." />
        {fe("addressProof")}
      </Section>

      <Section id="declaration" title="Declaration">
        <ToggleRow title="I collected these details and documents with this person's consent and they are genuine." name="consentDeclared" required />
        {fe("consentDeclared")}
      </Section>

      {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
      <button disabled={busy} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}