
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RoomOption = {
  id: string;
  label: string;
  capacity: number;
  rent: number;
  occupied: number;
};

export default function AllocationForm({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: RoomOption[];
}) {
  const router = useRouter();

  const availableRooms = rooms.filter(
    (r) => r.occupied < r.capacity
  );

  const [roomId, setRoomId] = useState(
    availableRooms[0]?.id ?? ""
  );

  const [monthlyRent, setMonthlyRent] = useState(
    String(availableRooms[0]?.rent ?? "")
  );

  const [error, setError] = useState("");
  const [residentUrl, setResidentUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;

    setBusy(true);
    setError("");

    const fd = new FormData(form);

    const send = () =>
      fetch(`/api/properties/${propertyId}/allocations`, {
        method: "POST",
        body: fd,
      });

    let res = await send();

    if (
      res.status === 401 &&
      (await fetch("/api/auth/refresh", {
        method: "POST",
      })).ok
    ) {
      res = await send();
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Could not allocate this person.");
      setBusy(false);
      return;
    }

    setResidentUrl(
      `${window.location.origin}${body.residentUrl}`
    );

    form.reset();
    router.refresh();

    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card">
      <label>
        Room

        <select
          name="roomId"
          value={
            availableRooms.some((r) => r.id === roomId)
              ? roomId
              : availableRooms[0]?.id ?? ""
          }
          onChange={(e) => {
            setRoomId(e.target.value);

            setMonthlyRent(
              String(
                availableRooms.find(
                  (r) => r.id === e.target.value
                )?.rent ?? ""
              )
            );
          }}
          required
        >
          {availableRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} · {r.occupied}/{r.capacity} occupied
              {" · "}
              ₹{r.rent.toLocaleString("en-IN")}/month
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <label>
          Full name
          <input name="fullName" required />
        </label>

        <label>
          Phone number
          <input name="phone" type="tel" required />
        </label>

        <label>
          Email (optional)
          <input name="email" type="email" />
        </label>

        <label>
          Move-in date
          <input
            name="moveInDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>

        <label>
          Monthly rent (₹)
          <input
            name="monthlyRent"
            type="number"
            min="0"
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
          />
        </label>

        <label>
          Security deposit (₹)
          <input
            name="securityDeposit"
            type="number"
            min="0"
            defaultValue="0"
          />
        </label>
      </div>

      <label>
        Resident documents (PDF/JPG/PNG/WebP, max 10 MB each, up to 8)

        <input
          name="documents"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button disabled={busy || !roomId}>
        {busy ? "Allocating…" : "Allocate person"}
      </button>

      {residentUrl && (
        <div className="notice">
          <strong>Allocation created.</strong>

          <p>Unique resident link:</p>

          <a
            href={residentUrl}
            target="_blank"
            rel="noreferrer"
          >
            {residentUrl}
          </a>

          <button
            type="button"
            className="button secondary"
            onClick={() => navigator.clipboard.writeText(residentUrl)}
          >
            Copy link
          </button>
        </div>
      )}
    </form>
  );
}