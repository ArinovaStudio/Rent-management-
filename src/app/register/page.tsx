"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), password: f.get("password") }),
    });
    if (res.ok) return router.push("/dashboard");
    setError((await res.json()).error ?? "Something went wrong.");
    setBusy(false);
  }

  return (
    <main>
      <h1>Create account</h1>
      <form onSubmit={onSubmit}>
        <label>Name<input name="name" required autoComplete="name" /></label>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>Create account</button>
      </form>
      <p className="or">or</p>
      <a className="button secondary" href="/api/auth/google" style={{ display: "block" }}>Continue with Google</a>
      <p className="muted">Already have an account? <a href="/login">Sign in</a></p>
    </main>
  );
}
