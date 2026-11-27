"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";
import { ID_PLACEHOLDER, ID_TYPES, ID_TYPE_LABEL, type IdTypeValue } from "@/lib/owner-validation";
import PasswordInput from "@/components/PasswordInput";
import PhotoPick from "@/components/PhotoPick";
import { F, FileDrop, Section, ToggleRow } from "@/app/dashboard/properties/property-sections";

const LABEL: Record<string, string> = { PROPERTY_ADMIN: "Property Admin", PROPERTY_MANAGER: "Property Manager" };
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export default function CreateUserForm({ roles }: { roles: string[] }) {
  const refresh = useSoftRefresh();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [idType, setIdType] = useState<IdTypeValue>("PAN");
  const [formKey, setFormKey] = useState(0); // changing it remounts the form, which also clears the file box
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
    toast(`${LABEL[body.role] ?? "Account"} created for ${body.name}`);
    setFormKey((k) => k + 1);
    refresh();
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground"><span className="text-destructive">*</span> means required. The person can sign in right away with the temporary password.</p>

      <Section id="account" title="Account">
        <F label="Role" req>
          <select className="field" name="role" defaultValue={roles[0]} required>
            {roles.map((r) => <option key={r} value={r}>{LABEL[r] ?? r}</option>)}
          </select>
        </F>
        <PhotoPick />
        {fe("photo")}
        <F label="Full legal name" req><input className="field" name="name" placeholder="e.g. Rahul Sharma" required />{fe("name")}</F>
        <F label="Age"><input className="field" name="age" type="number" inputMode="numeric" min={18} max={100} placeholder="e.g. 35" />{fe("age")}</F>
        <F label="Email" req><input className="field" name="email" type="email" placeholder="e.g. rahul@example.com" required />{fe("email")}</F>
        <F label="Mobile number" req><input className="field" name="phone" type="tel" placeholder="e.g. 98765 43210" required />{fe("phone")}</F>
        <F label="Temporary password" req wide><PasswordInput className="field" name="password" minLength={8} placeholder="At least 8 characters" required />{fe("password")}</F>
      </Section>

      <Section id="identity" title="Identity & address" hint="Only the last 4 characters of the ID number are stored. The document is kept privately.">
        <F label="ID type" req>
          <select className="field" name="idType" value={idType} onChange={(e) => setIdType(e.target.value as IdTypeValue)} required>
            {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
          </select>
          {fe("idType")}
        </F>
        <F label="ID number" req><input className="field" name="idNumber" placeholder={ID_PLACEHOLDER[idType]} autoComplete="off" required />{fe("idNumber")}</F>
        <FileDrop name="document" accept={ACCEPT} req title="Upload ID photo or PDF" hint="JPG, PNG, WebP or PDF, up to 10 MB" />
        {fe("document")}
        <F label="Street address" req wide><input className="field" name="addressLine1" placeholder="e.g. 12, Gandhi Nagar" required />{fe("addressLine1")}</F>
        <F label="Address line 2 (optional)" wide><input className="field" name="addressLine2" placeholder="e.g. Near City Mall" />{fe("addressLine2")}</F>
        <F label="City" req><input className="field" name="city" placeholder="e.g. Ratlam" required />{fe("city")}</F>
        <F label="State" req><input className="field" name="state" placeholder="e.g. Madhya Pradesh" required />{fe("state")}</F>
        <F label="PIN code" req><input className="field" name="postalCode" inputMode="numeric" placeholder="e.g. 457001" required />{fe("postalCode")}</F>
      </Section>

      <Section id="declaration" title="Declaration">
        <ToggleRow title="I collected these details and the ID document with this person's consent and they are genuine. *" name="consentDeclared" required />
        {fe("consentDeclared")}
      </Section>

      {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
      <button disabled={busy} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
