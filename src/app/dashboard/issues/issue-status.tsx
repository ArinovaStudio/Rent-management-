"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";

export default function IssueStatus({ id, status, note }: { id: string; status: string; note: string }) {
  const refresh = useSoftRefresh();
  const [s, setS] = useState(status);
  const [n, setN] = useState(note);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s, resolutionNote: n }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    refresh();
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
      <select className="field" value={s} onChange={(e) => setS(e.target.value)}>
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </select>
      <textarea className="field" rows={2} value={n} onChange={(e) => setN(e.target.value)} placeholder="Note for the manager (optional)" maxLength={2000} />
      <button type="button" disabled={busy} onClick={save} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:opacity-60">{busy ? "Saving…" : "Update"}</button>
      {error && <p className="text-sm text-destructive sm:col-span-3" role="alert">{error}</p>}
    </div>
  );
}
