"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

type M = { id: string; name: string; email: string };

export default function ManagerAssigner({ propertyId, assigned, candidates, }: { propertyId: string; assigned: M[]; candidates: M[] }) {
  const router = useRouter();
  const [managerId, setManagerId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: "POST" | "DELETE", id: string) {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}/managers`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    router.refresh();
    if (method === "POST") setManagerId("");
  }

  return (
    <div>
      <h2>Assigned managers</h2>
      {assigned.length === 0 ? (
        <p className="muted">No manager assigned yet.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {assigned.map((m) => (
            <li key={m.id}>
              {m.name} ({m.email}){" "}
              <button type="button" className="secondary" disabled={busy} onClick={() => call("DELETE", m.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Assign a manager</h2>
      {candidates.length === 0 ? (
        <p className="muted">No unassigned managers available.</p>
      ) : (
        <div className="card">
          <label>
            Manager
            <select value={managerId || candidates[0].id} onChange={(e) => setManagerId(e.target.value)}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => call("POST", managerId || candidates[0].id)}>
            Assign
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}