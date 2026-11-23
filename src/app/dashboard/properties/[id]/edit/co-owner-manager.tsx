"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";
import { Panel } from "@/components/admin/AdminShell";

type CoOwner = { userId: string; name: string; email: string; documents: number };

export default function CoOwnerManager({ propertyId, coOwners }: { propertyId: string; coOwners: CoOwner[] }) {
  const refresh = useSoftRefresh();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = async (method: "POST" | "DELETE", body: object) => {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}/co-owners`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong.");
      return false;
    }
    refresh();
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (await call("POST", { email })) setEmail("");
  };

  const remove = async (c: CoOwner) => {
    if (!window.confirm(`Remove ${c.name} as co-owner? Their uploaded proof documents will be deleted.`)) return;
    await call("DELETE", { userId: c.userId });
  };

  return (
    <Panel>
      <h2 className="text-xl font-semibold">Co-owners</h2>
      <p className="mt-1 text-sm text-muted-foreground">A co-owner must be a verified Property Admin. They are asked to upload their own proof documents.</p>

      <div className="mt-4 space-y-2">
        {coOwners.length === 0 && <p className="text-sm text-muted-foreground">No co-owners yet.</p>}
        {coOwners.map((c) => (
          <div key={c.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.email} · {c.documents} proof document{c.documents === 1 ? "" : "s"}</p>
            </div>
            <button type="button" disabled={busy} onClick={() => remove(c)} className="shrink-0 text-sm text-destructive disabled:opacity-50">Remove</button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="email" className="field min-w-0 flex-1" placeholder="Co-owner's email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy || !email.trim()} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Add co-owner"}</button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Panel>
  );
}