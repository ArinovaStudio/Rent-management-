"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/owner-validation";

const LABEL: Record<string, string> = {
  PROPERTY_ADMIN: "Property Admin",
  PROPERTY_MANAGER: "Property Manager",
};
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export default function CreateUserForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [role, setRole] = useState(roles[0]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fe = (k: string) => fieldErrors[k] && <span className="error" role="alert">{fieldErrors[k]}</span>;

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
    <form onSubmit={onSubmit}>
      <label>
        Role
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} required>
          {roles.map((r) => <option key={r} value={r}>{LABEL[r] ?? r}</option>)}
        </select>
      </label>

      <fieldset>
        <legend>Account</legend>
        <label>Full legal name<input name="name" required />{fe("name")}</label>
        <label>Email<input name="email" type="email" required />{fe("email")}</label>
        <label>Mobile number<input name="phone" type="tel" required />{fe("phone")}</label>
        <label>Temporary password<input name="password" type="password" required minLength={8} />{fe("password")}</label>
      </fieldset>

      <fieldset>
        <legend>Identity</legend>
        <label>
          ID type
          <select name="idType" defaultValue="PAN" required>
            {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
          </select>
          {fe("idType")}
        </label>
        <label>ID number (only the last 4 characters are stored)<input name="idNumber" required />{fe("idNumber")}</label>
        <label>ID photo or PDF<input name="document" type="file" accept={ACCEPT} required />{fe("document")}</label>
        <label>Street address<input name="addressLine1" required />{fe("addressLine1")}</label>
        <label>Address line 2 (optional)<input name="addressLine2" />{fe("addressLine2")}</label>
        <label>City<input name="city" required />{fe("city")}</label>
        <label>State<input name="state" required />{fe("state")}</label>
        <label>PIN code<input name="postalCode" inputMode="numeric" required />{fe("postalCode")}</label>
        <label>
          Address proof
          <input name="addressProof" type="file" accept={ACCEPT} required />
          {fe("addressProof")}
        </label>
      </fieldset>

      <label style={{ display: "block" }}>
        <input name="consentDeclared" type="checkbox" required /> I confirm I collected these details and documents
        with this person&apos;s consent and that they are genuine.
      </label>
      {fe("consentDeclared")}

      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}