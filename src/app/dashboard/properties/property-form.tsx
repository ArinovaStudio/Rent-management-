"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import MapPicker from "./map-picker";

type PType = "PG" | "APARTMENT" | "FLAT";
type RoomState = { id?: string; label: string; capacity: string; ac: boolean; rent: string; occupied: string };

export type InitialProperty = {
  id: string;
  name: string;
  description: string | null;
  type: PType;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  floors: number | null;
  sharing: boolean;
  rooms: { id: string; label: string; capacity: number; ac: boolean; rent: number; occupied: number }[];
  images: { id: string; path: string }[];
  documents: { id: string; name: string; path: string }[];
  // Only set for a Property Admin editing their own property: shows the ownership proof section.
  authorityProof?: { name: string } | null;
};

const blankRoom = (label: string): RoomState => ({ label, capacity: "2", ac: false, rent: "", occupied: "0" });

export default function PropertyForm({ initial, owners }: {
  initial?: InitialProperty;
  owners?: { id: string; name: string }[]; // only passed for a Super Admin creating a property
}) {
  const router = useRouter();
  const editing = !!initial;

  const [type, setType] = useState<PType>(initial?.type ?? "PG");
  const [sharing, setSharing] = useState(initial?.sharing ?? false);
  const [rooms, setRooms] = useState<RoomState[]>(
    initial?.rooms.length
      ? initial.rooms.map((r) => ({
          id: r.id, label: r.label, capacity: String(r.capacity), ac: r.ac,
          rent: String(r.rent), occupied: String(r.occupied),
        }))
      : [blankRoom("Room 1")]
  );
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [removeImages, setRemoveImages] = useState<string[]>([]);
  const [removeDocs, setRemoveDocs] = useState<string[]>([]);
  const [docRows, setDocRows] = useState<number[]>([0]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPG = type === "PG";
  const multiRoom = isPG || sharing; // PG and sharing flats have a list of rooms
  const maxSeats = isPG ? 4 : 6;

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const updateRoom = (i: number, patch: Partial<RoomState>) =>
    setRooms((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRoom = () =>
    setRooms((rs) => [
      ...rs,
      { ...blankRoom(`${isPG ? "Room" : "Bedroom"} ${rs.length + 1}`), rent: rs[rs.length - 1]?.rent ?? "" },
    ]);

  const shown = multiRoom ? rooms : rooms.slice(0, 1);
  const totalCap = multiRoom ? rooms.reduce((s, r) => s + Number(r.capacity || 0), 0) : 1;
  const totalOcc = shown.reduce((s, r) => s + Number(r.occupied || 0), 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const proofFile = fd.get("authorityProof");
    const hasProofFile = proofFile instanceof File && proofFile.size > 0;
    if (!editing && !owners && !hasProofFile) {
      setError("Upload proof that you own or are authorised to let this property.");
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const first = rooms[0];
    const payload = multiRoom
      ? rooms.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, ac: r.ac, rent: r.rent, occupied: r.occupied }))
      : [{ id: first.id, label: "Entire property", capacity: 1, ac: false, rent: first.rent, occupied: Math.min(Number(first.occupied) || 0, 1) }];
    fd.set("rooms", JSON.stringify(payload));
    fd.set("latitude", lat);
    fd.set("longitude", lng);
    fd.set("removeImageIds", JSON.stringify(removeImages));
    fd.set("removeDocIds", JSON.stringify(removeDocs));

    const res = await authFetch(editing ? `/api/properties/${initial!.id}` : "/api/properties", {
      method: editing ? "PUT" : "POST",
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/dashboard/properties?saved=${body.status === "PENDING" ? "pending" : "live"}`);
      router.refresh();
    } else {
      setError(body.error ?? "Something went wrong.");
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <p className="error" role="alert">{error}</p>}

      <fieldset>
        <legend>Basics</legend>
        <label>Property name<input name="name" required defaultValue={initial?.name} /></label>
        <label>
          Property type
          <select name="type" value={type} onChange={(e) => setType(e.target.value as PType)}>
            <option value="PG">PG</option>
            <option value="APARTMENT">Apartment</option>
            <option value="FLAT">Flat</option>
          </select>
        </label>
        {!isPG && (
          <label className="check">
            <input type="checkbox" name="sharing" checked={sharing} onChange={(e) => setSharing(e.target.checked)} />
            Sharing (several people share this property)
          </label>
        )}
        <label>Description<textarea name="description" rows={3} defaultValue={initial?.description ?? ""} /></label>
      </fieldset>

      <fieldset>
        <legend>Details</legend>
        <div className="row">
          {!isPG && <label>Bedrooms<input name="bedrooms" type="number" min={0} defaultValue={initial?.bedrooms ?? ""} /></label>}
          <label>Bathrooms<input name="bathrooms" type="number" min={0} defaultValue={initial?.bathrooms ?? ""} /></label>
          <label>Area (sq ft)<input name="areaSqft" type="number" min={0} defaultValue={initial?.areaSqft ?? ""} /></label>
          <label>Floors<input name="floors" type="number" min={0} defaultValue={initial?.floors ?? ""} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Location</legend>
        <label>Address<input name="address" required value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label>City<input name="city" required value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <MapPicker address={address} city={city} lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
      </fieldset>

      <fieldset>
        <legend>{multiRoom ? (isPG ? "Rooms" : "Rooms (one row per bedroom)") : "Rent & occupancy"}</legend>

        {multiRoom ? (
          <>
            {rooms.map((r, i) => (
              <div key={r.id ?? i} className="card">
                <div className="row">
                  <label>Name<input value={r.label} onChange={(e) => updateRoom(i, { label: e.target.value })} required /></label>
                  <label>
                    {isPG ? "Seater" : "Sharing between"}
                    <select value={r.capacity} onChange={(e) => updateRoom(i, { capacity: e.target.value })}>
                      {Array.from({ length: maxSeats }, (_, n) => n + 1).map((n) => (
                        <option key={n} value={n}>{isPG ? `${n} seater` : `${n} ${n === 1 ? "person" : "people"}`}</option>
                      ))}
                    </select>
                  </label>
                  <label>Rent per person / month (₹)<input type="number" min={0} value={r.rent} onChange={(e) => updateRoom(i, { rent: e.target.value })} required /></label>
                  {/* <label>Occupied (max {r.capacity})<input type="number" min={0} max={Number(r.capacity)} value={r.occupied} onChange={(e) => updateRoom(i, { occupied: e.target.value })} /></label> */}
                  <div>
                    <span className="muted">Currently occupied</span>
                    <strong>{r.occupied}/{r.capacity}</strong>
                  </div>
                </div>
                {isPG && (
                  <label className="check">
                    <input type="checkbox" checked={r.ac} onChange={(e) => updateRoom(i, { ac: e.target.checked })} />
                    AC room
                  </label>
                )}
                {rooms.length > 1 && (
                  <button type="button" className="button secondary" disabled={Number(r.occupied) > 0}
                    title={Number(r.occupied) > 0 ? "Rooms with people in them can't be removed" : ""}
                    onClick={() => setRooms((rs) => rs.filter((_, idx) => idx !== i))}>
                    Remove room
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="button secondary" onClick={addRoom}>+ Add room</button>
          </>
        ) : (
          <div className="row">
            <div>
              <span className="muted">Currently occupied</span>
              <strong>{rooms[0].occupied}/1</strong>
            </div>
          </div>
        )}
        <p className="muted" style={{ margin: 0 }}>
          Occupancy: {totalOcc}/{totalCap} {totalOcc >= totalCap ? "· no vacancy" : `· ${totalCap - totalOcc} available`}
        </p>
      </fieldset>

      <fieldset>
        <legend>Photos</legend>
        {initial && initial.images.length > 0 && (
          <div className="thumbs">
            {initial.images.map((img) => (
              <div key={img.id} className={removeImages.includes(img.id) ? "thumb removed" : "thumb"}>
                <img src={`/api/uploads/${img.path}`} alt="" />
                <button type="button" className="button secondary" onClick={() => setRemoveImages((l) => toggle(l, img.id))}>
                  {removeImages.includes(img.id) ? "Undo" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
        <label>
          Add photos (JPG, PNG or WebP, up to 5 MB each, 10 per property)
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple
            onChange={(e) => setPreviews(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))} />
        </label>
        {previews.length > 0 && (
          <div className="thumbs">{previews.map((src) => <div key={src} className="thumb"><img src={src} alt="" /></div>)}</div>
        )}
      </fieldset>

      {(editing ? initial?.authorityProof !== undefined : !owners) && (
        <fieldset>
          <legend>Ownership proof</legend>
          {editing && (
            <p style={{ margin: 0 }}>
              {initial?.authorityProof
                ? <>On file: <a href={`/api/property-authority/${initial.id}`} target="_blank" rel="noreferrer">{initial.authorityProof.name}</a>. Choose a file only to replace it.</>
                : "No ownership proof on file."}
            </p>
          )}
          <label>
            Proof of ownership or authority{editing ? "" : " (required for your first property)"}
            <input type="file" name="authorityProof" accept="application/pdf,image/jpeg,image/png,image/webp" />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Sale deed, property tax receipt, lease or power of attorney. PDF, JPG, PNG or WebP, up to 10 MB. This is reviewed separately from your account KYC.
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend>Legal documents</legend>
        {initial && initial.documents.length > 0 && (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {initial.documents.map((d) => (
              <li key={d.id} style={removeDocs.includes(d.id) ? { textDecoration: "line-through" } : undefined}>
                <a href={`/api/uploads/${d.path}`} target="_blank" rel="noreferrer">{d.name}</a>
                <button type="button" className="button secondary" style={{ padding: "2px 10px", marginLeft: 8 }}
                  onClick={() => setRemoveDocs((l) => toggle(l, d.id))}>
                  {removeDocs.includes(d.id) ? "Undo" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {docRows.map((key) => (
          <div key={key} className="row">
            <label>Document name<input name="docName" placeholder="e.g. Sale deed, NOC, Tax receipt" /></label>
            <label>File (PDF/image, up to 10 MB)<input type="file" name="docFile" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={() => setDocRows((r) => [...r, (r[r.length - 1] ?? 0) + 1])}>
          + Add another document
        </button>
      </fieldset>

      {owners && !editing && (
        <fieldset>
          <legend>Owner</legend>
          <label>
            Create this property for
            <select name="ownerId" defaultValue="">
              <option value="">Myself (Super Admin)</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </fieldset>
      )}

      <button disabled={busy}>{busy ? "Saving…" : editing ? "Update property" : "Create property"}</button>
    </form>
  );
}
