"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/owner-validation";
import { F, FileDrop, Section, ToggleRow } from "./property-sections";

export type TeamKind = "coOwner" | "manager";
export type TeamMember = { id: string; name: string; email: string; kind: TeamKind };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

// Popup to create a Co-owner (Property Admin) or Manager account with the same Account / Identity / Declaration fields as the old Users form.
// Portaled to document.body, but React still bubbles submit/keydown up the component tree into the property <form>,
// so those events must be stopped here or "Create co-owner" also saves the whole property.
export default function AddTeamMemberModal({
  open,
  kind,
  onKindChange,
  onClose,
  onCreated,
  canCreateCoOwner,
  canCreateManager,
}: {
  open: boolean;
  kind: TeamKind;
  onKindChange: (k: TeamKind) => void;
  onClose: () => void;
  onCreated: (m: TeamMember) => void;
  canCreateCoOwner: boolean;
  canCreateManager: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);

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
    const res = await authFetch("/api/users", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setFieldErrors(body.fieldErrors ?? {});
      return;
    }
    toast(`${label} account created for ${body.name}`);
    onCreated({ id: body.id, name: body.name, email: body.email, kind });
    setFormKey((k) => k + 1);
    onClose();
  }

  // Keep Enter / submit from reaching the property form that owns this modal in the React tree.
  function trap(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return createPortal(
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={`Add ${label}`} onKeyDown={trap} onSubmit={trap}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Add {label.toLowerCase()}</h3>
            <p className="text-sm text-muted-foreground">Creates their account and keeps ID details on file. They can sign in with the temporary password.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <form ref={formRef} key={formKey} onSubmit={onSubmit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
            <div className="flex flex-wrap gap-2">
              {canCreateCoOwner && (
                <button type="button" onClick={() => onKindChange("coOwner")} className={`rounded-full px-4 py-2 text-sm ${kind === "coOwner" ? "bg-primary text-primary-foreground" : "bg-cream hover:bg-cream/70"}`}>
                  Co-owner
                </button>
              )}
              {canCreateManager && (
                <button type="button" onClick={() => onKindChange("manager")} className={`rounded-full px-4 py-2 text-sm ${kind === "manager" ? "bg-primary text-primary-foreground" : "bg-cream hover:bg-cream/70"}`}>
                  Manager
                </button>
              )}
            </div>
          </div>

          <Section id="account" title="Account">
            <F label="Full legal name" req><input className="field" name="name" required />{fe("name")}</F>
            <F label="Email" req><input className="field" name="email" type="email" required />{fe("email")}</F>
            <F label="Mobile number" req><input className="field" name="phone" type="tel" required />{fe("phone")}</F>
            <F label="Temporary password" req><input className="field" name="password" type="password" minLength={8} required />{fe("password")}</F>
          </Section>

          <Section id="identity" title="Identity & address" hint="Only the last 4 characters of the ID number are stored. The document is kept privately.">
            <F label="ID type" req>
              <select className="field" name="idType" defaultValue="PAN" required>
                {ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}
              </select>
              {fe("idType")}
            </F>
            <F label="ID number" req><input className="field" name="idNumber" required />{fe("idNumber")}</F>
            <FileDrop name="document" accept={ACCEPT} req title="Upload ID photo or PDF" hint="JPG, PNG, WebP or PDF, up to 10 MB" />
            {fe("document")}
            <F label="Street address" req wide><input className="field" name="addressLine1" required />{fe("addressLine1")}</F>
            <F label="Address line 2 (optional)" wide><input className="field" name="addressLine2" />{fe("addressLine2")}</F>
            <F label="City" req><input className="field" name="city" required />{fe("city")}</F>
            <F label="State" req><input className="field" name="state" required />{fe("state")}</F>
            <F label="PIN code" req><input className="field" name="postalCode" inputMode="numeric" required />{fe("postalCode")}</F>
          </Section>

          <Section id="declaration" title="Declaration">
            <ToggleRow title="I collected these details and the ID document with this person's consent and they are genuine. *" name="consentDeclared" required />
            {fe("consentDeclared")}
          </Section>

          {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
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
