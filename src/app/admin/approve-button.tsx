"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";

// Approve a property straight from its card. Same endpoint as the review page, no note needed.
export default function ApproveButton({ propertyId }: { propertyId: string }) {
  const refresh = useSoftRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/admin/properties/${propertyId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", note: "" }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={approve} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-ink disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Approve
      </button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
