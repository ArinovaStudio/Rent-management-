"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

type Option = { action: string; label: string; needsNote: boolean };

// Approve / reject / request-info buttons with one shared note box. `url` is the review endpoint.
export default function ReviewPanel({ url, options }: { url: string; options: Option[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(o: Option) {
    if (o.needsNote && !note.trim()) return setError("Write a note first. It's required for this action.");
    setBusy(true);
    setError("");
    const res = await authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: o.action, note }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    setNote("");
    router.refresh();
  }

  const style = (action: string) =>
    action === "APPROVE"
      ? "bg-primary text-primary-foreground hover:bg-ink"
      : action === "REJECT" || action === "RESTRICT"
      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
      : "bg-cream hover:bg-cream/70";

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Note (required to reject or request more information; the owner is emailed this)</span>
        <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.action} type="button" disabled={busy} onClick={() => submit(o)} className={`rounded-full px-6 py-3 disabled:opacity-60 ${style(o.action)}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}