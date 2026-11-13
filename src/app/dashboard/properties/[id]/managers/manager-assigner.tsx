"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import { Panel } from "@/components/admin/AdminShell";

type M = { id: string; name: string; email: string };

export default function ManagerAssigner({ propertyId, assigned, candidates }: { propertyId: string; assigned: M[]; candidates: M[] }) {
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
    <div className="space-y-6">
      <Panel>
        <h2 className="mb-4 text-xl font-semibold">Assigned managers</h2>
        {assigned.length === 0 ? (
          <p className="text-muted-foreground">No manager assigned yet.</p>
        ) : (
          <ul className="divide-y divide-cream">
            {assigned.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => call("DELETE", m.id)} className="rounded-full bg-cream px-5 py-2 text-sm hover:bg-cream/70 disabled:opacity-60">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-4 text-xl font-semibold">Assign a manager</h2>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground">No verified, unassigned managers available.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[16rem] flex-1 flex-col gap-2 text-sm">
              <span className="font-medium">Manager</span>
              <select className="field" value={managerId || candidates[0].id} onChange={(e) => setManagerId(e.target.value)}>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => call("POST", managerId || candidates[0].id)} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
              Assign
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
      </Panel>
    </div>
  );
}