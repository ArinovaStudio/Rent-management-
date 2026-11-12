"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";
import MapPicker from "./map-picker";
import { PairList, TagPicker, toPairs, type Pair } from "./property-sections";
import {
  CATEGORIES, FURNISHING, FACING, AMENITY_PRESETS, FEATURE_PRESETS,
  ROOM_TYPES, BATH_TYPES, label, type ListingClient, type ListedBy
} from "@/lib/property-fields";
import { canWriteField } from "@/lib/permissions";
import type { Role } from "@/lib/jwt";

type GalleryItem = { key: string; src: string; id?: string; file?: File };
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
  listing?: ListingClient;
  // Only set for a Property Admin editing their own property: shows the ownership proof section.
  authorityProof?: { name: string } | null;
};

const blankRoom = (label: string): RoomState => ({ label, capacity: "2", ac: false, rent: "", occupied: "0" });

export default function PropertyForm({ initial, owners, role, listedBy }: {
  initial?: InitialProperty;
  owners?: { id: string; name: string }[];
  role: Role;
  listedBy?: ListedBy | null;
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
  const L = initial?.listing;
  const can = (f: string) => canWriteField(role, f);
  const [price, setPrice] = useState(L?.price != null ? String(L.price) : "");
  const [area, setArea] = useState(L?.builtUpAreaSqm != null ? String(L.builtUpAreaSqm) : "");
  const [roomLayout, setRoomLayout] = useState<Pair[]>(toPairs(L?.roomLayout, "type", "size"));
  const [bathLayout, setBathLayout] = useState<Pair[]>(toPairs(L?.bathroomLayout, "type", "size"));
  const [amenities, setAmenities] = useState<string[]>(L?.amenities ?? []);
  const [features, setFeatures] = useState<string[]>(L?.features ?? []);
  const [nearby, setNearby] = useState<Pair[]>(toPairs(L?.nearbyPlaces, "name", "distanceKm"));
  const [gallery, setGallery] = useState<GalleryItem[]>(
    (initial?.images ?? []).map((i) => ({ key: i.id, id: i.id, src: `/api/uploads/${i.path}` }))
  );
  // const [removeImages, setRemoveImages] = useState<string[]>([]);
  const [removeDocs, setRemoveDocs] = useState<string[]>([]);
  const [docRows, setDocRows] = useState<number[]>([0]);
  // const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPG = type === "PG";
  const multiRoom = isPG || sharing; // PG and sharing flats have a list of rooms
  const maxSeats = isPG ? 4 : 6;
  const perSqm = Number(price) > 0 && Number(area) > 0 ? Math.round(Number(price) / Number(area)) : null;

  const addPhotos = (files: FileList | null) => {
    // Copy the files out before the input is cleared: clearing it empties the live FileList,
    // and React may run the state updater after that.
    const picked = Array.from(files ?? []).slice(0, Math.max(10 - gallery.length, 0));
    if (picked.length === 0) return;
    const items = picked.map((f) => ({
      key: `${f.name}-${f.size}-${Math.random()}`,
      src: URL.createObjectURL(f),
      file: f,
    }));
    setGallery((g) => [...g, ...items].slice(0, 10));
  };
  const movePhoto = (i: number, to: number) =>
    setGallery((g) => {
      if (to < 0 || to >= g.length) return g;
      const c = [...g];
      const [x] = c.splice(i, 1);
      c.splice(to, 0, x);
      return c;
    });
  const dropPhoto = (i: number) => setGallery((g) => g.filter((_, k) => k !== i));

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
    // fd.set("removeImageIds", JSON.stringify(removeImages));
    // Photos: new files in gallery order, plus the final order and which saved photos were removed
    fd.delete("images");
    gallery.forEach((g) => { if (g.file) fd.append("images", g.file); });
    let n = 0;
    fd.set("imageOrder", JSON.stringify(gallery.map((g) => g.id ?? `new:${n++}`)));
    fd.set("removeImageIds", JSON.stringify((initial?.images ?? []).filter((i) => !gallery.some((g) => g.id === i.id)).map((i) => i.id)));
    const asRows = (rows: Pair[], a: string, b: string) => JSON.stringify(rows.filter((r) => r.a.trim() || r.b).map((r) => ({ [a]: r.a, [b]: r.b })));
    fd.set("roomLayout", asRows(roomLayout, "type", "size"));
    fd.set("bathroomLayout", asRows(bathLayout, "type", "size"));
    fd.set("nearbyPlaces", asRows(nearby, "name", "distanceKm"));
    fd.set("amenities", JSON.stringify(amenities));
    fd.set("features", JSON.stringify(features));
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
        <legend>Photos</legend>
        <p className="muted" style={{ margin: 0 }}>The first photo is the cover. Use ◀ ▶ to reorder, or “Make cover”.</p>
        {gallery.length > 0 && (
          <div className="thumbs">
            {gallery.map((g, i) => (
              <div key={g.key} className="thumb">
                <img src={g.src} alt="" />
                {i === 0
                  ? <strong>Cover</strong>
                  : <button type="button" className="button secondary" onClick={() => movePhoto(i, 0)}>Make cover</button>}
                <div>
                  <button type="button" className="button secondary" disabled={i === 0} aria-label="Move earlier" onClick={() => movePhoto(i, i - 1)}>◀</button>
                  <button type="button" className="button secondary" disabled={i === gallery.length - 1} aria-label="Move later" onClick={() => movePhoto(i, i + 1)}>▶</button>
                  <button type="button" className="button secondary" onClick={() => dropPhoto(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label>
          Add photos (JPG, PNG or WebP, up to 5 MB each, 10 per property)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={gallery.length >= 10}
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Basics</legend>
        <label>Title<input name="name" required maxLength={150} defaultValue={initial?.name} /></label>
        <div className="row">
          <label>Category
            <select name="category" defaultValue={L?.category ?? "RESIDENTIAL"}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
          </label>
          <label>
            Property type
            <select name="type" value={type} onChange={(e) => setType(e.target.value as PType)}>
              <option value="PG">PG</option>
              <option value="APARTMENT">Apartment</option>
              <option value="FLAT">Flat</option>
            </select>
          </label>
        </div>
        {!isPG && (
          <label className="check">
            <input type="checkbox" name="sharing" checked={sharing} onChange={(e) => setSharing(e.target.checked)} />
            Sharing (several people share this property)
          </label>
        )}
        <div className="row">
          <label>City<input name="city" required value={city} onChange={(e) => setCity(e.target.value)} /></label>
          <label>District<input name="district" maxLength={80} defaultValue={L?.district ?? ""} /></label>
          <label>State<input name="state" maxLength={80} defaultValue={L?.state ?? ""} /></label>
        </div>
        <div className="row">
          <label>Year built<input name="yearBuilt" type="number" min={1800} max={new Date().getFullYear() + 10} defaultValue={L?.yearBuilt ?? ""} /></label>
          <label>Developer<input name="developer" maxLength={120} defaultValue={L?.developer ?? ""} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Price &amp; size</legend>
        <div className="row">
          <label>Price (₹)<input name="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Service charge (₹ / year)<input name="serviceCharge" type="number" min={0} defaultValue={L?.serviceCharge ?? ""} /></label>
        </div>
        <div className="row">
          <label>Built-up area (m²)<input name="builtUpAreaSqm" type="number" min={0} step="any" value={area} onChange={(e) => setArea(e.target.value)} /></label>
          {/* <label>Plot size (m²)<input name="plotSizeSqm" type="number" min={0} step="any" defaultValue={L?.plotSizeSqm ?? ""} /></label> */}
          {!isPG && <label>Bedrooms<input name="bedrooms" type="number" min={0} defaultValue={initial?.bedrooms ?? ""} /></label>}
          <label>Bathrooms<input name="bathrooms" type="number" min={0} defaultValue={initial?.bathrooms ?? ""} /></label>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Price per m²: <strong>{perSqm != null ? `₹${perSqm.toLocaleString("en-IN")}` : "—"}</strong> (calculated automatically)
        </p>
      </fieldset>

      <fieldset>
        <legend>Description</legend>
        <label>Short description<input name="shortDescription" maxLength={300} defaultValue={L?.shortDescription ?? ""} /></label>
        <label>Full description<textarea name="description" rows={5} defaultValue={initial?.description ?? ""} /></label>
        <label>Video tour URL<input name="videoUrl" type="url" maxLength={500} placeholder="https://" defaultValue={L?.videoUrl ?? ""} /></label>
        <label>
          …or upload a video (MP4 or WebM, up to 50 MB)
          <input type="file" name="video" accept="video/mp4,video/webm" />
        </label>
        {L?.videoPath && (
          <label className="check">
            <input type="checkbox" name="removeVideo" />
            Remove the uploaded video (<a href={`/api/uploads/${L.videoPath}`} target="_blank" rel="noreferrer">view</a>)
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Specifications</legend>
        <div className="row">
          <label>Floors / level<input name="floors" type="number" min={0} defaultValue={initial?.floors ?? ""} /></label>
          <label>Parking spaces<input name="parkingSpaces" type="number" min={0} max={100} defaultValue={L?.parkingSpaces ?? ""} /></label>
          <label>Furnishing
            <select name="furnishing" defaultValue={L?.furnishing ?? ""}>
              <option value="">Not specified</option>
              {FURNISHING.map((f) => <option key={f} value={f}>{label(f)}</option>)}
            </select>
          </label>
          <label>Facing
            <select name="facing" defaultValue={L?.facing ?? ""}>
              <option value="">Not specified</option>
              {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label>Title deed number<input name="titleDeedNumber" maxLength={50} autoComplete="off" defaultValue={L?.titleDeedNumber ?? ""} /></label>
          <label>Handover date
            <input name="handoverDate" type="date" defaultValue={L?.handoverDate ?? ""} />
          </label>
        </div>
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
        <legend>Room &amp; bathroom layout</legend>
        <p className="muted" style={{ margin: 0 }}>Describes the property for listings. Rentable rooms are managed above.</p>
        <PairList rows={roomLayout} onChange={setRoomLayout} aLabel="Room type" bLabel="Size (m²)" addLabel="+ Add room" aOptions={ROOM_TYPES} />
        <PairList rows={bathLayout} onChange={setBathLayout} aLabel="Bathroom type" bLabel="Area (m²)" addLabel="+ Add bathroom" aOptions={BATH_TYPES} />
      </fieldset>

      <fieldset>
        <legend>Amenities</legend>
        <TagPicker presets={AMENITY_PRESETS} value={amenities} onChange={setAmenities} />
      </fieldset>
      <fieldset>
        <legend>Features &amp; finishes</legend>
        <TagPicker presets={FEATURE_PRESETS} value={features} onChange={setFeatures} />
      </fieldset>

      <fieldset>
        <legend>Location</legend>
        <label>Address<input name="address" required value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <MapPicker address={address} city={city} lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
        <strong>Nearby places</strong>
        <PairList rows={nearby} onChange={setNearby} aLabel="Place" bLabel="Distance (km)" addLabel="+ Add place" />
      </fieldset>
      
      <fieldset>
        <legend>Listed by</legend>
        {listedBy ? (
          <>
            <p style={{ margin: 0 }}><strong>{listedBy.title}</strong></p>
            {listedBy.subtitle && <p className="muted" style={{ margin: 0 }}>{listedBy.subtitle}</p>}
            {listedBy.phone && <p style={{ margin: 0 }}>Phone: {listedBy.phone}</p>}
            {listedBy.email && <p style={{ margin: 0 }}>Email: {listedBy.email}</p>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            After saving, this shows the owner you selected, or the Property Management Team if you list it under your own account.
          </p>
        )}
        <p className="muted" style={{ margin: 0 }}>Taken from the owner&apos;s account. To change it, update the owner&apos;s profile.</p>
      </fieldset>

      <fieldset>
        <legend>Visibility</legend>
        <label className="check">
          <input type="checkbox" name="isPublished" defaultChecked={L?.isPublished ?? true} disabled={!can("isPublished")} />
          Published (visible to the public once approved)
        </label>
        <label className="check">
          <input type="checkbox" name="featured" defaultChecked={L?.featured ?? false} disabled={!can("featured")} />
          Featured property{!can("featured") ? " (only a Super Admin can change this)" : ""}
        </label>
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
