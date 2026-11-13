"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { F, Section } from "@/app/dashboard/properties/property-sections";

type RoomOption = { id: string; label: string; capacity: number; rent: number; occupied: number };

export default function AllocationForm({ propertyId, rooms }: { propertyId: string; rooms: RoomOption[] }) {
  const router = useRouter();
  const availableRooms = rooms.filter((r) => r.occupied < r.capacity);
  const [roomId, setRoomId] = useState(availableRooms[0]?.id ?? "");
  const [monthlyRent, setMonthlyRent] = useState(String(availableRooms[0]?.rent ?? ""));
  const [error, setError] = useState("");
  const [residentUrl, setResidentUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    const fd = new FormData(form);
    const send = () => fetch(`/api/properties/${propertyId}/allocations`, { method: "POST", body: fd });

    let res = await send();
    if (res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST" })).ok) {
      res = await send();
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not allocate this person.");
      setBusy(false);
      return;
    }
    setResidentUrl(`${window.location.origin}${body.residentUrl}`);
    form.reset();
    router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section id="allocate" title="Allocate a person">
        <F label="Room" wide>
          <select
            className="field"
            name="roomId"
            value={availableRooms.some((r) => r.id === roomId) ? roomId : availableRooms[0]?.id ?? ""}
            onChange={(e) => {
              setRoomId(e.target.value);
              setMonthlyRent(String(availableRooms.find((r) => r.id === e.target.value)?.rent ?? ""));
            }}
            required
          >
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} · {r.occupied}/{r.capacity} occupied · ₹{r.rent.toLocaleString("en-IN")}/month
              </option>
            ))}
          </select>
        </F>
        <F label="Full name"><input className="field" name="fullName" required /></F>
        <F label="Phone number"><input className="field" name="phone" type="tel" required /></F>
        <F label="Email (optional)"><input className="field" name="email" type="email" /></F>
        <F label="Move-in date">
          <input className="field" name="moveInDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </F>
        <F label="Monthly rent (₹)">
          <input className="field" name="monthlyRent" type="number" min="0" required value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
        </F>
        <F label="Security deposit (₹)"><input className="field" name="securityDeposit" type="number" min="0" defaultValue="0" /></F>
        <F label="Resident documents (PDF/JPG/PNG/WebP, max 10 MB each, up to 8)" wide>
          <input className="field" name="documents" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple />
        </F>
      </Section>

      {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}

      <button disabled={busy || !roomId} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
        {busy ? "Allocating…" : "Allocate person"}
      </button>

      {residentUrl && (
        <div className="space-y-2 rounded-2xl bg-primary/10 px-5 py-4 text-sm">
          <p className="font-medium text-primary">Allocation created.</p>
          <p className="text-muted-foreground">Unique resident link:</p>
          <a className="break-all text-primary underline" href={residentUrl} target="_blank" rel="noreferrer">{residentUrl}</a>
          <div>
            <button type="button" onClick={() => navigator.clipboard.writeText(residentUrl)} className="rounded-full bg-background px-4 py-2 hover:bg-cream">
              Copy link
            </button>
          </div>
        </div>
      )}
    </form>
  );
}