"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";

type P = { id: string; name: string; rooms: { id: string; label: string }[] };

export default function IssueForm({ properties }: { properties: P[] }) {
  const refresh = useSoftRefresh();
  const [propertyId, setPropertyId] = useState(properties[0].id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rooms = properties.find((p) => p.id === propertyId)?.rooms ?? [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.get("title"),
        description: f.get("description"),
        priority: f.get("priority"),
        roomId: f.get("roomId") || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    form.reset();
    refresh();
  }

  const lbl = "grid gap-1.5 text-sm";
  return (
    <form onSubmit={submit} className="mb-6 min-w-0 space-y-4 rounded-[1.75rem] bg-background p-5 md:p-6">
      <h2 className="text-lg font-semibold">Report an issue</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          <span className="font-medium">Property</span>
          <select className="field" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className={lbl}>
          <span className="font-medium">Room (optional)</span>
          <select className="field" name="roomId" key={propertyId} defaultValue="">
            <option value="">Whole property</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label className={lbl}><span className="font-medium">Title</span><input className="field" name="title" required maxLength={150} /></label>
        <label className={lbl}>
          <span className="font-medium">Priority</span>
          <select className="field" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>
      <label className={lbl}><span className="font-medium">Description</span><textarea className="field" name="description" rows={4} required maxLength={4000} /></label>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <button disabled={busy} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:opacity-60">{busy ? "Sending…" : "Send to owner"}</button>
    </form>
  );
}
