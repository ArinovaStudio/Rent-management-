"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
type Existing = { id: string; name: string; originalName: string; uploadedAt: string | Date };

export default function CoOwnerDocumentForm({ propertyId, documents }: { propertyId: string; documents: Existing[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true); setError(""); setSuccess("");
    const response = await authFetch(`/api/properties/${propertyId}/co-owner-documents`, { method: "POST", body: new FormData(form) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Could not upload the document."); return; }
    form.reset(); setSuccess("Proof document uploaded successfully."); router.refresh();
  }
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border p-5">
        <div><label className="mb-1 block text-sm font-medium" htmlFor="co-owner-doc-name">Document name</label><input id="co-owner-doc-name" className="field" name="name" required maxLength={120} placeholder="e.g. Co-ownership deed" /></div>
        <div><label className="mb-1 block text-sm font-medium" htmlFor="co-owner-doc-file">Proof document</label><input id="co-owner-doc-file" className="field" name="document" type="file" accept={ACCEPT} required /><p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG or WebP · up to 10 MB</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {success && <p role="status" className="text-sm text-primary">{success}</p>}
        <button disabled={busy} className="rounded-full bg-primary px-5 py-3 text-primary-foreground disabled:opacity-60">{busy ? "Uploading…" : "Upload proof"}</button>
      </form>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Submitted documents</h2>
        {documents.length === 0 ? <p className="text-sm text-muted-foreground">No proof documents submitted yet.</p> : documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-4">
            <div><p className="font-medium">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.originalName} · {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p></div>
            <a className="text-sm text-primary underline" href={`/api/co-owner-documents/${doc.id}`} target="_blank" rel="noreferrer">View document</a>
          </div>
        ))}
      </div>
    </div>
  );
}
