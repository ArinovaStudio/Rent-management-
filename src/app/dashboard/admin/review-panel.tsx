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

  return (
    <div>
      {error && <p className="error" role="alert">{error}</p>}
      <label>
        Note (required to reject or request more information; the owner is emailed this)
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>
      <div className="actions">
        {options.map((o) => (
          <button key={o.action} type="button" disabled={busy} className={o.action === "APPROVE" ? "" : "secondary"} onClick={() => submit(o)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
