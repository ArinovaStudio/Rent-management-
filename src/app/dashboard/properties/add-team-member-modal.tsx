"use client";

import ExperienceFields from "./experience-fields";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";
import { ID_PLACEHOLDER, ID_TYPES, ID_TYPE_LABEL, type IdTypeValue } from "@/lib/owner-validation";
import PasswordInput from "@/components/PasswordInput";
import PhotoPick from "@/components/PhotoPick";
import { F, FileDrop, ToggleRow } from "./property-sections";

export type TeamKind = "coOwner" | "manager";
// `password` is kept in memory only while the property form is open, so the login mail can go out after the property is saved.
export type TeamMember = { id: string; name: string; email: string; kind: TeamKind; password?: string };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

// Popup to create a Co-owner (Property Admin) or Manager account with the same Account / Identity / Declaration fields as the old Users form.
// Portaled to document.body, but React still bubbles submit/keydown up the component tree into the property <form>,
// so those events must be stopped here or "Create co-owner" also saves the whole property.
export default function AddTeamMemberModal({
  open,
  kind,
  onClose,
  onCreated,
  defer = false,
}: {
  open: boolean;
  kind: TeamKind;
  onClose: () => void;
  onCreated: (m: TeamMember) => void;
  // true inside the property form: no email is sent now, it is sent when the property is saved.
  defer?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [idType, setIdType] = useState<IdTypeValue>("PAN");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const role = kind === "coOwner" ? "PROPERTY_ADMIN" : "PROPERTY_MANAGER";
  const label = kind === "coOwner" ? "Co-owner" : "Manager";
  const fe = (k: string) => fieldErrors[k] && <span role="alert" className="text-xs text-destructive sm:col-span-2">{fieldErrors[k]}</span>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setFieldErrors({});
    const fd = new FormData(form);
    fd.set("role", role);
    if (defer) fd.set("deferEmail", "1");
    const res = await authFetch("/api/users", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setFieldErrors(body.fieldErrors ?? {});
      return;
    }
    toast(defer ? `${label} ${body.name} added. They are emailed when you save the property.` : `${label} account created for ${body.name}`);
    onCreated({ id: body.id, name: body.name, email: body.email, kind, ...(defer ? { password: String(fd.get("password") ?? "") } : {}) });
    setFormKey((k) => k + 1);
    onClose();
  }

  // Keep Enter / submit from reaching the property form that owns this modal in the React tree.
  function trap(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return createPortal(
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={`Add ${label}`} onKeyDown={trap} onSubmit={trap}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Add {label.toLowerCase()}</h3>
            <p className="text-sm text-muted-foreground">Photo and age are optional. They can sign in with the temporary password.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <form ref={formRef} key={formKey} onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5 lg:flex-row">
            <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
              <F label="Full legal name" req><input className="field" name="name" placeholder="e.g. Rahul Sharma" required />{fe("name")}</F>
              <F label="Age"><input className="field" name="age" type="number" inputMode="numeric" min={18} max={100} placeholder="e.g. 35" />{fe("age")}</F>
              <F label="Email" req><input className="field" name="email" type="email" placeholder="e.g. rahul@example.com" required />{fe("email")}</F>
              <F label="Mobile number" req><input className="field" name="phone" type="tel" placeholder="e.g. 98765 43210" required />{fe("phone")}</F>
              <ExperienceFields fe={fe} />
              <F label="Temporary password" req wide><PasswordInput className="field" name="password" minLength={8} placeholder="At least 8 characters" required />{fe("password")}</F>

              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:col-span-2">Identity &amp; address <span className="font-normal normal-case">· only the last 4 characters of the ID number are stored</span></p>
              <F label="ID type" req>
                <select className="field" name="idType" value={idType} onChange={(e) => setIdType(e.target.value as IdTypeValue)} required>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
                </select>
                {fe("idType")}
              </F>
              <F label="ID number" req><input className="field" name="idNumber" placeholder={ID_PLACEHOLDER[idType]} autoComplete="off" required />{fe("idNumber")}</F>
              <FileDrop onClear={() => {}} name="document" accept={ACCEPT} req title="Upload ID photo or PDF" hint="JPG, PNG, WebP or PDF, up to 10 MB" />
              {fe("document")}
              <F label="Street address" req wide><input className="field" name="addressLine1" placeholder="e.g. 12, Gandhi Nagar" required />{fe("addressLine1")}</F>
              <F label="Address line 2 (optional)" wide><input className="field" name="addressLine2" placeholder="e.g. Near City Mall" />{fe("addressLine2")}</F>
              <F label="City" req><input className="field" name="city" placeholder="e.g. Ratlam" required />{fe("city")}</F>
              <F label="State" req><input className="field" name="state" placeholder="e.g. Madhya Pradesh" required />{fe("state")}</F>
              <F label="PIN code" req><input className="field" name="postalCode" inputMode="numeric" placeholder="e.g. 457001" required />{fe("postalCode")}</F>

              <ToggleRow title="I collected these details and the ID document with this person's consent and they are genuine. *" name="consentDeclared" required />
              {fe("consentDeclared")}
            </div>

            <div className="order-first lg:order-none lg:w-72 lg:shrink-0">
              <PhotoPick variant="tile" />
              {fe("photo")}
            </div>
          </div>

          {error && <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 border-t border-cream p-4">
          <button type="button" onClick={onClose} className="rounded-full bg-cream px-6 py-3 hover:bg-cream/70">Cancel</button>
          <button type="button" disabled={busy} onClick={() => formRef.current?.requestSubmit()} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Creating…" : `Create ${label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}