"use client";
import { useState, Suspense } from "react";
import PasswordInput from "@/components/PasswordInput";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="tw flex min-h-screen items-center justify-center bg-cream/60 px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">R</span>
          <div>
            <p className="text-2xl font-medium tracking-tight">Rental <span className="text-muted-foreground">Portal</span></p>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your properties.</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-background p-6 md:p-8">
          <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="grid gap-1.5 text-sm">
              Email
              <input className="field" name="email" type="email" required autoComplete="email" placeholder="e.g. rahul@example.com" />
            </label>
            <label className="grid gap-1.5 text-sm">
              Password
              <PasswordInput className="field" name="password" required autoComplete="current-password" placeholder="Your password" />
            </label>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-cream" />
            or
            <span className="h-px flex-1 bg-cream" />
          </div>

          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center rounded-full bg-cream px-5 py-3 text-sm font-medium hover:bg-primary/10"
          >
            Continue with Google
          </a>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
