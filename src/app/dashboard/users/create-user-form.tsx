"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LABEL: Record<string, string> = {
  PROPERTY_ADMIN: "Property Admin",
  PROPERTY_MANAGER: "Property Manager",
};

export default function CreateUserForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // If the access token expired, refresh once and retry.
  async function post(body: unknown) {
    const send = () =>
      fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    let res = await send();
    if (res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST" })).ok) {
      res = await send();
    }
    return res;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    const f = new FormData(form);
    const res = await post({
      name: f.get("name"),
      email: f.get("email"),
      password: f.get("password"),
      role: f.get("role"),
    });
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit}>
      <label>Name<input name="name" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Temporary password<input name="password" type="password" required minLength={8} /></label>
      <label>
        Role
        <select name="role" required>
          {roles.map((r) => <option key={r} value={r}>{LABEL[r] ?? r}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>Create account</button>
    </form>
  );
}