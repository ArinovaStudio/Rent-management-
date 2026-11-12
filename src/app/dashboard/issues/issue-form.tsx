"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

type P = { id: string; name: string; rooms: { id: string; label: string }[] };

export default function IssueForm({ properties }: { properties: P[] }) {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card">
      <h2 style={{ marginTop: 0 }}>Report an issue</h2>
      <label>
        Property
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>
        Room (optional)
        <select name="roomId" key={propertyId} defaultValue="">
          <option value="">Whole property</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      <label>Title<input name="title" required maxLength={150} /></label>
      <label>Description<textarea name="description" rows={4} required maxLength={4000} /></label>
      <label>
        Priority
        <select name="priority" defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Sending…" : "Send to owner"}</button>
    </form>
  );
}