"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const oauthError = useSearchParams().get("error");
  const [error, setError] = useState(oauthError ? "Google sign-in failed. Try again." : "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
    });
    if (res.ok) return router.push((await res.json()).next ?? "/dashboard");
    setError((await res.json()).error ?? "Something went wrong.");
    setBusy(false);
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Sign in</button>
      </form>
      <p className="or">or</p>
      <a className="button secondary" href="/api/auth/google" style={{ display: "block" }}>Continue with Google</a>
      <p className="muted">New here? <a href="/register">Create an account</a></p>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
