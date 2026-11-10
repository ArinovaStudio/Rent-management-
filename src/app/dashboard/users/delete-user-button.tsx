"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteUserButton({ id, name, deletesManagers, }: {
  id: string;
  name: string;
  deletesManagers: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    const message = deletesManagers ? `Delete ${name} and all managers they created? This can't be undone.`: `Delete ${name}? This can't be undone.`;
    if (!confirm(message)) return;

    setBusy(true);
    setError("");
    const send = () => fetch(`/api/users/${id}`, { method: "DELETE" });
    let res = await send();
    // If the access token expired, refresh once and retry.
    if (res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST" })).ok) {
      res = await send();
    }
    if (res.ok) {
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Could not delete this account.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button secondary" style={{ padding: "2px 10px", marginLeft: 8 }} onClick={onClick} disabled={busy}>
        Delete
      </button>
      {error && <span className="error" role="alert"> {error}</span>}
    </>
  );
}