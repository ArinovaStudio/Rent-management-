"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

export default function IssueStatus({ id, status, note }: { id: string; status: string; note: string }) {
  const router = useRouter();
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
    router.refresh();
  }

  return (
    <div>
      <select value={s} onChange={(e) => setS(e.target.value)}>
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </select>
      <textarea rows={2} value={n} onChange={(e) => setN(e.target.value)} placeholder="Note for the manager (optional)" maxLength={2000} />
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={save}>Update</button>
    </div>
  );
}