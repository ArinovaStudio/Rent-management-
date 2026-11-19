"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

const btn = "rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-ink disabled:opacity-60";
const ghost = "rounded-full bg-cream px-5 py-2 text-sm hover:bg-cream/70 disabled:opacity-60";
const lbl = "grid gap-1.5 text-sm";

// Actions shown inside the dashboard verification banner.
export default function VerificationActions({ needsEmail, needsDocument }: { needsEmail: boolean; needsDocument: boolean }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setMsg("");
    const res = await authFetch(url, init);
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg(body.error ?? "Something went wrong.");
    return res.ok;
  }

  if (!needsEmail && !needsDocument) return null;

  return (
    <div className="mt-4 space-y-3">
      {needsEmail && (
        <div className="space-y-3">
          {!sent ? (
            <button type="button" className={btn} disabled={busy} onClick={async () => (await call("/api/verify/email/send", { method: "POST" })) && setSent(true)}>
              Send email code
            </button>
          ) : (
            <>
              <label className={`${lbl} max-w-xs`}>
                Enter the 6-digit code we emailed you
                <input className="field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn}
                  disabled={busy || code.length !== 6}
                  onClick={async () =>
                    (await call("/api/verify/email/confirm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code }),
                    })) && router.refresh()
                  }
                >
                  Verify email
                </button>
                <button type="button" className={ghost} disabled={busy} onClick={() => call("/api/verify/email/send", { method: "POST" })}>
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {needsDocument && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (await call("/api/owner-documents", { method: "POST", body: fd })) router.refresh();
          }}
        >
          <label className={`${lbl} max-w-xs`}>
            Document to replace
            <select className="field" name="type" defaultValue="ID_DOCUMENT">
              <option value="ID_DOCUMENT">ID document</option>
              <option value="ADDRESS_PROOF">Address proof</option>
            </select>
          </label>
          <label className={`${lbl} max-w-xs`}>
            New file
            <input className="field" type="file" name="document" required accept="application/pdf,image/jpeg,image/png,image/webp" />
          </label>
          <button className={btn} disabled={busy}>Upload and resubmit</button>
        </form>
      )}
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
