"use client";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";

const btn = "rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";
const ghost = "rounded-full bg-background px-5 py-2.5 text-sm font-medium shadow-sm ring-1 ring-black/15 hover:bg-cream disabled:opacity-60";
const lbl = "grid gap-1.5 text-sm";
const panel = "min-w-0 rounded-[1.75rem] bg-background p-5 md:p-6";

type Result = { ok: boolean; error?: string; field?: string };

async function post(url: string, body?: unknown): Promise<Result> {
  const res = await authFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Something went wrong.", field: data.field };
}

function NewPasswordFields({ pw, setPw, again, setAgain }: { pw: string; setPw: (v: string) => void; again: string; setAgain: (v: string) => void }) {
  return (
    <>
      <label className={lbl}>New password
        <PasswordInput className="field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <span className="text-xs text-muted-foreground">At least 8 characters.</span>
      </label>
      <label className={lbl}>Confirm new password
        <PasswordInput className="field" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </label>
    </>
  );
}

// ---- Admin-created account: change the temporary password with the current one ----
function ChangeTemporaryPassword() {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!current) return setError("Enter your current (temporary) password.");
    if (pw !== again) return setError("The new passwords don't match.");
    setBusy(true);
    const r = await post("/api/profile/password", { currentPassword: current, newPassword: pw });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setCurrent(""); setPw(""); setAgain("");
    toast("Password changed.");
  }

  return (
    <form onSubmit={submit} className={`${panel} space-y-4`}>
      <div>
        <h2 className="text-xl font-semibold">Change your temporary password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your account was created for you with a temporary password. Choose your own so only you know it.</p>
      </div>
      <label className={lbl}>Current (temporary) password
        <PasswordInput className="field" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <NewPasswordFields pw={pw} setPw={setPw} again={again} setAgain={setAgain} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button className={btn} disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}

// ---- Self-registered account: verify the email ----
function VerifyEmail({ email }: { email: string }) {
  const refresh = useSoftRefresh();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setError("");
    const r = await post("/api/verify/email/send");
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setSent(true);
    toast(`Code sent to ${email}.`);
  }
  async function confirm() {
    setBusy(true); setError("");
    const r = await post("/api/verify/email/confirm", { code });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    toast("Email verified.");
    refresh();
  }

  return (
    <div className={`${panel} space-y-4`}>
      <div>
        <h2 className="text-xl font-semibold">Verify your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">We will send a 6-digit code to {email}.</p>
      </div>
      {!sent ? (
        <button type="button" className={btn} disabled={busy} onClick={send}>{busy ? "Sending…" : "Send code"}</button>
      ) : (
        <>
          <label className={`${lbl} max-w-xs`}>Enter the 6-digit code
            <input className="field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy || code.length !== 6} onClick={confirm}>Verify email</button>
            <button type="button" className={ghost} disabled={busy} onClick={send}>Resend code</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ---- Self-registered account: change (or set) the password with an emailed code ----
function ChangePasswordByCode({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setError("");
    const r = await post("/api/profile/password/code");
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setSent(true);
    toast(`Code sent to ${email}.`);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw !== again) return setError("The new passwords don't match.");
    setBusy(true);
    const r = await post("/api/profile/password", { code, newPassword: pw });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setSent(false); setCode(""); setPw(""); setAgain("");
    toast("Password changed.");
  }

  return (
    <div className={`${panel} space-y-4`}>
      <div>
        <h2 className="text-xl font-semibold">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">We email a 6-digit code to {email} to confirm it is you.</p>
      </div>
      {!sent ? (
        <button type="button" className={btn} disabled={busy} onClick={send}>{busy ? "Sending…" : "Send code"}</button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className={`${lbl} max-w-xs`}>Enter the 6-digit code
            <input className="field" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <NewPasswordFields pw={pw} setPw={setPw} again={again} setAgain={setAgain} />
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy || code.length !== 6}>{busy ? "Saving…" : "Change password"}</button>
            <button type="button" className={ghost} disabled={busy} onClick={send}>Resend code</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function ProfileForms({ isSuperAdmin, createdByAdmin, emailVerified, hasPassword, email }: { isSuperAdmin: boolean; createdByAdmin: boolean; emailVerified: boolean; hasPassword: boolean; email: string }) {
  if (createdByAdmin) return <ChangeTemporaryPassword />;
  return (
    <>
      {!emailVerified && !isSuperAdmin && <VerifyEmail email={email} />}
      <ChangePasswordByCode email={email} hasPassword={hasPassword} />
    </>
  );
}