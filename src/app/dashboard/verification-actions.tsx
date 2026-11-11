"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

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

  return (
    <div style={{ marginTop: 12 }}>
      {needsEmail && (
        <div>
          {!sent ? (
            <button type="button" disabled={busy} onClick={async () => (await call("/api/verify/email/send", { method: "POST" })) && setSent(true)}>
              Send email code
            </button>
          ) : (
            <>
              <label>
                Enter the 6-digit code we emailed you
                <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <button
                type="button"
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
              </button>{" "}
              <button type="button" disabled={busy} onClick={() => call("/api/verify/email/send", { method: "POST" })}>
                Resend code
              </button>
            </>
          )}
        </div>
      )}
      {needsDocument && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (await call("/api/owner-documents", { method: "POST", body: fd })) router.refresh();
          }}
        >
          <label>
            Document to replace
            <select name="type" defaultValue="ID_DOCUMENT">
              <option value="ID_DOCUMENT">ID document</option>
              <option value="ADDRESS_PROOF">Address proof</option>
            </select>
          </label>
          <label>
            New file
            <input type="file" name="document" required accept="application/pdf,image/jpeg,image/png,image/webp" />
          </label>
          <button disabled={busy}>Upload and resubmit</button>
        </form>
      )}
      {msg && <p className="error" role="alert">{msg}</p>}
    </div>
  );
}
