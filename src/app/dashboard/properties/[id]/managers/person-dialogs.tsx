"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BadgeCheck, FileText, Loader2, Pencil, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";
import { ID_TYPE_LABEL, type IdTypeValue } from "@/lib/owner-validation";
import PhotoPick from "@/components/PhotoPick";
import { F, FileDrop } from "../../property-sections";

export type PersonKind = "owner" | "coOwner" | "manager";
export type PersonDoc = { id: string; name: string; type: string };
export type Person = {
  id: string; kind: PersonKind; name: string; email: string; phone: string | null; age: number | null; photoPath: string | null; verified: boolean;
  addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null;
  idType: string | null; idNumberMasked: string | null;
  // editable: Super Admin, or the Property Admin who created this person. documents: only filled for people allowed to open them.
  editable?: boolean; documents?: PersonDoc[];
};
export const KIND_LABEL: Record<PersonKind, string> = { owner: "Main owner", coOwner: "Co-owner", manager: "Manager" };

function Shell({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
        {footer && <div className="flex justify-end gap-3 border-t border-cream p-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const DOC_LABEL: Record<string, string> = { ID_DOCUMENT: "ID document", ADDRESS_PROOF: "Address proof", COMPANY_REGISTRATION: "Company registration", AUTHORITY_PROOF: "Authority proof" };
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

// Opens the private file in a new tab. The server checks who may read it and logs the view.
function DocLinks({ docs }: { docs: PersonDoc[] }) {
  if (docs.length === 0) return null;
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.id}>
          <a href={`/api/owner-documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm hover:bg-cream">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span><span className="block text-xs text-muted-foreground">{DOC_LABEL[d.type] ?? d.type} · tap to view</span></span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl bg-cream/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

const btnSoft = "rounded-full bg-cream px-6 py-2.5 text-sm hover:bg-cream/70";
const btnMain = "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:opacity-60";

export function PersonDetailsDialog({ person: p, onClose, onEdit }: { person: Person; onClose: () => void; onEdit?: () => void }) {
  const address = [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.postalCode].filter(Boolean).join(", ");
  return (
    <Shell
      title={p.name}
      subtitle={KIND_LABEL[p.kind]}
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSoft} onClick={onClose}>Close</button>
        {onEdit && <button type="button" className={btnMain} onClick={onEdit}><Pencil className="h-4 w-4" />Edit</button>}
      </>}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 lg:flex-row">
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-3xl bg-cream lg:w-72">
          {p.photoPath
            ? <Image src={`/api/uploads/${p.photoPath}`} alt={p.name} fill sizes="(min-width: 1024px) 288px, 90vw" className="object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-7xl font-medium text-primary/60">{p.name.slice(0, 1).toUpperCase()}</span>}
          {p.verified && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs text-primary"><BadgeCheck className="h-4 w-4" />Verified</span>}
        </div>
        <div className="grid min-w-0 flex-1 content-start gap-3 sm:grid-cols-2">
          <Row label="Full name" value={p.name} />
          <Row label="Role" value={KIND_LABEL[p.kind]} />
          <Row label="Age" value={p.age ? `${p.age} years` : null} />
          <Row label="Mobile number" value={p.phone} />
          <div className="sm:col-span-2"><Row label="Email" value={p.email} /></div>
          <div className="sm:col-span-2"><Row label="Address" value={address} /></div>
          <Row label="ID type" value={p.idType ? ID_TYPE_LABEL[p.idType as IdTypeValue] ?? p.idType : null} />
          <Row label="ID number" value={p.idNumberMasked} />
          {(p.documents?.length ?? 0) > 0 && <div className="grid gap-2 sm:col-span-2"><p className="text-xs text-muted-foreground">Uploaded documents</p><DocLinks docs={p.documents!} /></div>}
        </div>
      </div>
    </Shell>
  );
}

export function PersonEditDialog({ propertyId, endpoint, person: p, onClose, onSaved }: { propertyId?: string; endpoint?: string; person: Person; onClose: () => void; onSaved: (name?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fe = (k: string) => fieldErrors[k] && <span role="alert" className="text-xs text-destructive sm:col-span-2">{fieldErrors[k]}</span>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setFieldErrors({});
    const res = await authFetch(endpoint ?? `/api/properties/${propertyId}/people/${p.id}`, { method: "PATCH", body: new FormData(e.currentTarget) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Something went wrong."); setFieldErrors(body.fieldErrors ?? {}); return; }
    toast(`${body.name} updated`);
    onSaved(body.name);
    onClose();
  }

  return (
    <Shell
      title={`Edit ${KIND_LABEL[p.kind].toLowerCase()}`}
      subtitle="Email and ID number can't be changed here. You can replace the ID document."
      onClose={onClose}
      footer={<>
        <button type="button" className={btnSoft} onClick={onClose}>Cancel</button>
        <button type="submit" form="edit-person-form" className={btnMain} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>
      </>}
    >
      <form id="edit-person-form" onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
            <F label="Full legal name" req><input className="field" name="name" defaultValue={p.name} placeholder="e.g. Rahul Sharma" required />{fe("name")}</F>
            <F label="Age"><input className="field" name="age" type="number" inputMode="numeric" min={18} max={100} defaultValue={p.age ?? ""} placeholder="e.g. 35" />{fe("age")}</F>
            <F label="Email"><input className="field opacity-60" value={p.email} disabled readOnly /></F>
            <F label="Mobile number" req><input className="field" name="phone" type="tel" defaultValue={p.phone ?? ""} placeholder="e.g. 98765 43210" required />{fe("phone")}</F>
            <F label="Street address" req wide><input className="field" name="addressLine1" defaultValue={p.addressLine1 ?? ""} placeholder="e.g. 12, Gandhi Nagar" required />{fe("addressLine1")}</F>
            <F label="Address line 2 (optional)" wide><input className="field" name="addressLine2" defaultValue={p.addressLine2 ?? ""} placeholder="e.g. Near City Mall" />{fe("addressLine2")}</F>
            <F label="City" req><input className="field" name="city" defaultValue={p.city ?? ""} placeholder="e.g. Ratlam" required />{fe("city")}</F>
            <F label="State" req><input className="field" name="state" defaultValue={p.state ?? ""} placeholder="e.g. Madhya Pradesh" required />{fe("state")}</F>
            <F label="PIN code" req><input className="field" name="postalCode" inputMode="numeric" defaultValue={p.postalCode ?? ""} placeholder="e.g. 457001" required />{fe("postalCode")}</F>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <p className="text-sm font-medium">ID document</p>
              <DocLinks docs={p.documents ?? []} />
              <FileDrop wide={false} onClear={() => {}} name="document" accept={ACCEPT} title={(p.documents?.length ?? 0) > 0 ? "Replace ID document" : "Upload ID document"} hint="JPG, PNG, WebP or PDF, up to 10 MB. Leave empty to keep the current one." />
              {fe("document")}
            </div>
          </div>
          <div className="order-first lg:order-none lg:w-72 lg:shrink-0">
            <PhotoPick variant="tile" current={p.photoPath} />
            {fe("photo")}
          </div>
        </div>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
      </form>
    </Shell>
  );
}