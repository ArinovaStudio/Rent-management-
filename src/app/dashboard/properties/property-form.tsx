"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bath as BathIcon, BedDouble, ChevronLeft, ChevronRight, FileText, ImagePlus, MapPin, Maximize, Plus, Star, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import MapPicker from "./map-picker";
import { F, FileDrop, PairList, Section, SavingOverlay, TagPicker, ToggleRow, toPairs, type Pair } from "./property-sections";
import {
  FURNISHING, FACING, AMENITY_PRESETS, FEATURE_PRESETS,
  ROOM_TYPES, BATH_TYPES, PLATFORM_LISTER, label, type ListingClient, type ListedBy
} from "@/lib/property-fields";
import { canWriteField } from "@/lib/permissions";
import type { Role } from "@/lib/jwt";
import { propertiesBase } from "@/lib/routes";

type GalleryItem = { key: string; src: string; id?: string; file?: File };
type PType = "PG" | "APARTMENT" | "FLAT";
type Bath = "Attached" | "Common";
type RoomState = { id?: string; label: string; capacity: string; ac: boolean; rent: string; occupied: string };
type CategoryMedia = { id?: string; capacity: number; mediaType: "IMAGE" | "VIDEO"; path?: string; originalName: string; src: string; file?: File };

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
  roomsPerFloor?: number | null;
  sharing: boolean;
  rooms: { id: string; label: string; capacity: number; ac: boolean; rent: number; occupied: number }[];
  images: { id: string; path: string }[];
  categoryMedia?: { id: string; capacity: number; mediaType: "IMAGE" | "VIDEO"; path: string; originalName: string }[];
  documents: { id: string; name: string; path: string }[];
  listing?: ListingClient;
  // Only set for a Property Admin editing their own property: shows the ownership proof section.
  authorityProof?: { name: string } | null;
};

const NAV = [["Photos & video", "photos"], ["Basics", "basics"], ["Rent & size", "rent"], ["Description", "description"], ["Specifications", "specifications"], ["Rooms", "rooms"], ["Layout", "layout"], ["Amenities", "amenities"], ["Location", "location"], ["Listed by", "listed-by"], ["Visibility", "visibility"], ["Documents", "documents"]] as const;
const TYPE_OPTIONS: [PType, string, string][] = [
  ["PG", "PG", "Rooms shared by several people"],
  ["APARTMENT", "Apartment", "A whole apartment unit"],
  ["FLAT", "Flat", "A flat or independent floor"],
];
const sm = "field !bg-background";
const blankRoom = (label: string): RoomState => ({ label, capacity: "2", ac: false, rent: "", occupied: "0" });

// PG bathrooms are saved as "<n> seater – Attached|Common" rows (no size)
const bathLabel = (n: number, b: Bath) => `${n} seater – ${b}`;
const readPgBath = (v: unknown): Record<number, Bath> => {
  const out: Record<number, Bath> = {};
  for (const p of toPairs(v, "type", "size")) {
    const m = /^(\d+) seater\s*[–-]\s*(Attached|Common)$/.exec(p.a);
    if (m) out[Number(m[1])] = m[2] as Bath;
  }
  return out;
};

export default function PropertyForm({ initial, owners, role, listedBy }: {
  initial?: InitialProperty;
  owners?: { id: string; name: string }[];
  role: Role;
  listedBy?: ListedBy | null;
}) {
  const router = useRouter();
  const editing = !!initial;
  const single = initial?.rooms[0];

  const [type, setType] = useState<PType>(initial?.type ?? "PG");
  const [sharing, setSharing] = useState(initial?.sharing ?? false);
  // Existing room records are kept in state; PG room records are generated from category quantities.
  const [rooms, setRooms] = useState<RoomState[]>(
    (initial?.rooms ?? []).map((r) => ({
      id: r.id, label: r.label, capacity: String(r.capacity), ac: r.ac,
      rent: String(r.rent), occupied: String(r.occupied),
    }))
  );
  // PG room categories: the seater types this property offers. Nothing is selected by default.
  const [cats, setCats] = useState<number[]>(() =>
    Array.from(new Set((initial?.rooms ?? []).map((r) => r.capacity))).sort((a, b) => a - b)
  );
  const [catWarn, setCatWarn] = useState("");
  const [categoryCounts, setCategoryCounts] = useState<Record<number, string>>(() => {
    const counts: Record<number, string> = {};
    for (const room of initial?.rooms ?? []) counts[room.capacity] = String((Number(counts[room.capacity]) || 0) + 1);
    return counts;
  });
  const [categoryMedia, setCategoryMedia] = useState<CategoryMedia[]>(() =>
    (initial?.categoryMedia ?? []).map((m) => ({ ...m, src: `/api/uploads/${m.path}` }))
  );
  const [roomManagerOpen, setRoomManagerOpen] = useState(false);
  const [activeRoomCategory, setActiveRoomCategory] = useState<number>(initial?.rooms[0]?.capacity ?? 1);
  const [roomPage, setRoomPage] = useState(0);
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const L = initial?.listing;
  const can = (f: string) => canWriteField(role, f);
  const base = propertiesBase(role);
  const [price, setPrice] = useState(L?.price != null ? String(L.price) : "");
  const [area, setArea] = useState(L?.builtUpAreaSqm != null ? String(L.builtUpAreaSqm) : "");
  const [roomLayout, setRoomLayout] = useState<Pair[]>(toPairs(L?.roomLayout, "type", "size"));
  const [bathLayout, setBathLayout] = useState<Pair[]>(toPairs(L?.bathroomLayout, "type", "size"));
  const [pgBath, setPgBath] = useState<Record<number, Bath>>(() => readPgBath(L?.bathroomLayout));
  const [amenities, setAmenities] = useState<string[]>(L?.amenities ?? []);
  const [features, setFeatures] = useState<string[]>(L?.features ?? []);
  const [nearby, setNearby] = useState<Pair[]>(toPairs(L?.nearbyPlaces, "name", "distanceKm"));
  const [gallery, setGallery] = useState<GalleryItem[]>(
    (initial?.images ?? []).map((i) => ({ key: i.id, id: i.id, src: `/api/uploads/${i.path}` }))
  );
  const [removeDocs, setRemoveDocs] = useState<string[]>([]);
  const [docRows, setDocRows] = useState<number[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [coOwnerId, setCoOwnerId] = useState("");
  // UI-only state for the live card preview
  const [title, setTitle] = useState(initial?.name ?? "");
  const [short, setShort] = useState(L?.shortDescription ?? "");
  const [beds, setBeds] = useState(initial?.bedrooms != null ? String(initial.bedrooms) : "");
  const [baths, setBaths] = useState(initial?.bathrooms != null ? String(initial.bathrooms) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPG = type === "PG";
  const multiRoom = isPG || sharing; // PG and sharing flats have a list of rooms
  const maxSeats = isPG ? 5 : 6;
  const perSqm = Number(price) > 0 && Number(area) > 0 ? Math.round(Number(price) / Number(area)) : null;
  const rents = rooms.map((r) => Number(r.rent)).filter((n) => n > 0);
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const ownerName = owners?.find((o) => o.id === ownerId)?.name;

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
      {
        ...blankRoom(`${isPG ? "Room" : "Bedroom"} ${rs.length + 1}`),
        capacity: String(isPG ? (cats[0] ?? 2) : 2),
        rent: rs[rs.length - 1]?.rent ?? "",
      },
    ]);

  const roomsUsing = (n: number) => rooms.filter((r) => Number(r.capacity) === n).length;


  const requestedRoomTotal = Object.values(categoryCounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const generateRooms = () => {
    if (Object.values(categoryCounts).some((value) => !Number.isInteger(Number(value || 0)) || Number(value || 0) < 0)) { setCatWarn("Room quantities must be whole numbers greater than or equal to zero."); return; }
    if (requestedRoomTotal > 100) { setCatWarn("A property can have up to 100 rooms."); return; }
    if (requestedRoomTotal < 1) { setCatWarn("Enter at least one room across the categories."); return; }
    const next: RoomState[] = [];
    for (let capacity = 1; capacity <= maxSeats; capacity += 1) {
      const count = Number(categoryCounts[capacity]) || 0;
      const existing = rooms.filter((room) => Number(room.capacity) === capacity);
      if (count < existing.length && existing.slice(count).some((room) => Number(room.occupied) > 0)) {
        setCatWarn(`Some ${capacity} seater rooms have active residents. Reallocate them before reducing this category quantity.`);
        return;
      }
      for (let i = 0; i < count; i += 1) {
        next.push(existing[i] ?? {
          ...blankRoom(`${capacity} Seater - Room ${i + 1}`),
          capacity: String(capacity),
          rent: existing[existing.length - 1]?.rent ?? "",
        });
      }
    }
    setRooms(next);
    const selected = Array.from({ length: maxSeats }, (_, i) => i + 1).filter((n) => Number(categoryCounts[n]) > 0);
    setCats(selected);
    setCategoryMedia((items) => items.filter((item) => selected.includes(item.capacity)));
    setActiveRoomCategory(selected[0] ?? 1);
    setRoomPage(0);
    setCatWarn("");
    setRoomManagerOpen(true);
  };

  const addCategoryMedia = (capacity: number, mediaType: "IMAGE" | "VIDEO", files: FileList | null) => {
    const picked = Array.from(files ?? []);
    const current = categoryMedia.filter((m) => m.capacity === capacity && m.mediaType === mediaType).length;
    const limit = mediaType === "IMAGE" ? 10 : 5;
    if (current + picked.length > limit) { setCatWarn(`${capacity} seater category allows up to ${limit} ${mediaType === "IMAGE" ? "photos" : "videos"}.`); return; }
    setCategoryMedia((items) => [...items, ...picked.map((file) => ({ capacity, mediaType, file, originalName: file.name, src: URL.createObjectURL(file) }))]);
    setCatWarn("");
  };

  const removeCategoryMediaItem = (item: CategoryMedia) => setCategoryMedia((items) => items.filter((m) => m !== item));

  const singleOcc = Math.min(single?.occupied ?? 0, 1);
  const totalCap = multiRoom ? rooms.reduce((s, r) => s + Number(r.capacity || 0), 0) : 1;
  const totalOcc = multiRoom ? rooms.reduce((s, r) => s + Number(r.occupied || 0), 0) : singleOcc;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const stop = (msg: string) => {
      setError(msg);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const fd = new FormData(e.currentTarget);
    const proofFile = fd.get("authorityProof");
    const hasProofFile = proofFile instanceof File && proofFile.size > 0;
    if (!editing && !owners && !hasProofFile) return stop("Upload proof that you own or are authorised to let this property.");
    if (multiRoom && rooms.length === 0) return stop("Add at least one room.");
    if (isPG && Array.from({ length: maxSeats }, (_, i) => i + 1).some((capacity) => Number(categoryCounts[capacity] || 0) !== roomsUsing(capacity))) {
      return stop("Click “Generate / update rooms” after changing category quantities.");
    }

    const payload = multiRoom
      ? rooms.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, ac: r.ac, rent: r.rent, occupied: r.occupied }))
      // A single unit's rent is the Rent field (falls back to what was saved before)
      : [{ id: single?.id, label: "Entire property", capacity: 1, ac: false, rent: Number(price) > 0 ? price : String(single?.rent ?? 0), occupied: singleOcc }];
    fd.set("rooms", JSON.stringify(payload));
    fd.set("latitude", lat);
    fd.set("longitude", lng);
    // PG rent is per room: the listing price is the lowest room rent
    if (isPG) fd.set("price", minRent ? String(minRent) : "");
    // Photos: new files in gallery order, plus the final order and which saved photos were removed
    fd.delete("images");
    gallery.forEach((g) => { if (g.file) fd.append("images", g.file); });
    let n = 0;
    fd.set("imageOrder", JSON.stringify(gallery.map((g) => g.id ?? `new:${n++}`)));
    fd.set("removeImageIds", JSON.stringify((initial?.images ?? []).filter((i) => !gallery.some((g) => g.id === i.id)).map((i) => i.id)));
    for (let capacity = 1; capacity <= maxSeats; capacity += 1) {
      fd.delete(`categoryMedia_${capacity}_images`);
      fd.delete(`categoryMedia_${capacity}_videos`);
    }
    if (isPG) categoryMedia.forEach((media) => {
      if (media.file) fd.append(`categoryMedia_${media.capacity}_${media.mediaType === "IMAGE" ? "images" : "videos"}`, media.file);
    });
    fd.set("removeCategoryMediaIds", JSON.stringify((initial?.categoryMedia ?? []).filter((m) => !categoryMedia.some((current) => current.id === m.id)).map((m) => m.id)));
    const asRows = (rows: Pair[], a: string, b: string) => JSON.stringify(rows.filter((r) => r.a.trim() || r.b).map((r) => ({ [a]: r.a, [b]: r.b })));
    if (isPG) {
      fd.set("roomLayout", "[]");
      fd.set("bathroomLayout", JSON.stringify(cats.map((c) => ({ type: bathLabel(c, pgBath[c] ?? "Attached"), size: "" }))));
    } else {
      fd.set("roomLayout", asRows(roomLayout, "type", "size"));
      fd.set("bathroomLayout", asRows(bathLayout, "type", "size"));
    }
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
      router.push(`${base}?saved=${body.status === "PENDING" ? "pending" : "live"}`);
      router.refresh();
    } else {
      stop(body.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="tw block">
      {busy && <SavingOverlay label={editing ? "Saving changes…" : "Creating property…"} />}

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={base} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="mr-auto">
          <h1 className="text-4xl font-medium tracking-tight">{editing ? "Edit property" : "Add property"}</h1>
          <p className="text-muted-foreground">{editing ? initial!.name : "Fill in every detail tenants see on the listing page."}</p>
        </div>
        <Link href={base} className="rounded-full bg-background px-6 py-3">Cancel</Link>
        <button disabled={busy} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Update property" : "Create property"}
        </button>
      </div>

      {error && <p role="alert" className="mb-6 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[200px_1fr_340px]">
        <nav className="hidden xl:block">
          <ul className="sticky top-24 space-y-1">
            {NAV.map(([t, id]) => <li key={id}><a href={`#${id}`} className="block rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground">{t}</a></li>)}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="photos" title="Photos & video" hint="Add up to 10 photos (JPG, PNG or WebP, max 5 MB each). The first photo is the cover; use the arrows to reorder.">
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
              {gallery.map((g, i) => (
                <div key={g.key} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream">
                  <img src={g.src} alt={`Property photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-background px-3 py-1 text-xs">Cover</span>}
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button type="button" disabled={i === 0} onClick={() => movePhoto(i, i - 1)} aria-label="Move photo earlier" className="rounded-full bg-background p-1.5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" disabled={i === gallery.length - 1} onClick={() => movePhoto(i, i + 1)} aria-label="Move photo later" className="rounded-full bg-background p-1.5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                      {i !== 0 && <button type="button" onClick={() => movePhoto(i, 0)} className="rounded-full bg-background px-2.5 text-xs">Make cover</button>}
                    </div>
                    <button type="button" onClick={() => dropPhoto(i)} aria-label="Remove photo" className="rounded-full bg-background p-1.5 text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {gallery.length < 10 && (
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-cream text-muted-foreground hover:bg-muted">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-sm">Upload photos</span>
                  <span className="text-xs">{gallery.length}/10</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                    onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            <div className="border-t border-cream pt-4 sm:col-span-2"><p className="font-medium">Video tour</p></div>
            <FileDrop name="video" accept="video/mp4,video/webm" title="Upload a property video" hint="MP4 or WebM · up to 50 MB" />
            {L?.videoPath && (
              <>
                <ToggleRow title="Remove existing video" desc="Switch on to delete the current video when you save." name="removeVideo" />
                <a href={`/api/uploads/${L.videoPath}`} target="_blank" rel="noreferrer" className="w-fit text-sm text-primary hover:underline">View current video</a>
              </>
            )}
          </Section>

          <Section id="basics" title="Basics">
            <F label="Property title" wide>
              <input className="field" name="name" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Premium furnished PG near ...." />
            </F>

            <div className="sm:col-span-2">
              <p className="mb-2 px-1 text-sm text-muted-foreground">Property type</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {TYPE_OPTIONS.map(([v, t, hint]) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="peer sr-only" />
                    <span className="flex items-center gap-3 rounded-2xl border border-transparent bg-cream p-4 transition-colors hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:[&_.dot]:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                      <span className="dot h-3 w-3 shrink-0 rounded-full bg-muted-foreground/50" />
                      <span>
                        <span className="block font-medium">{t}</span>
                        <span className="block text-sm text-muted-foreground">{hint}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {!isPG && (
              <ToggleRow title="Shared accommodation" desc="Several people share this property." name="sharing" checked={sharing} onChange={(e) => setSharing(e.target.checked)} />
            )}

            <F label="City"><input className="field" name="city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" /></F>
            <F label="District"><input className="field" name="district" maxLength={80} defaultValue={L?.district ?? ""} placeholder="Enter district" /></F>
            <F label="State"><input className="field" name="state" maxLength={80} defaultValue={L?.state ?? ""} placeholder="Enter state" /></F>
            <F label="Year built"><input className="field" name="yearBuilt" type="number" min={1800} max={new Date().getFullYear() + 10} defaultValue={L?.yearBuilt ?? ""} placeholder="e.g. 2022" /></F>
            <F label="Developer"><input className="field" name="developer" maxLength={120} defaultValue={L?.developer ?? ""} placeholder="Enter developer name" /></F>
          </Section>

          <Section id="description" title="Description">
            <F label="Short description (shown on cards)" wide>
              <input className="field" name="shortDescription" maxLength={300} value={short} onChange={(e) => setShort(e.target.value)} placeholder="A short introduction to your property" />
            </F>
            <F label="Full description" wide>
              <textarea className="field resize-none rounded-[1.5rem]" name="description" rows={7} defaultValue={initial?.description ?? ""} placeholder="Describe the property, its surroundings and important details..." />
            </F>
            <F label="Video tour link (optional)" wide>
              <input className="field" name="videoUrl" type="url" maxLength={500} placeholder="https://" defaultValue={L?.videoUrl ?? ""} />
            </F>
          </Section>

          <Section id="specifications" title="Specifications">
            {!isPG && <F label="Bedrooms"><input className="field" name="bedrooms" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="Number of bedrooms" /></F>}
            <F label="Bathrooms"><input className="field" name="bathrooms" type="number" min={0} value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="Number of bathrooms" /></F>
            <F label={isPG ? "Floors" : "Floors / level"}><input className="field" name="floors" type="number" min={0} defaultValue={initial?.floors ?? ""} /></F>
            {isPG && <F label="Rooms per floor"><input className="field" name="roomsPerFloor" type="number" min={0} defaultValue={initial?.roomsPerFloor ?? ""} /></F>}
            {!isPG && <F label="Parking spaces"><input className="field" name="parkingSpaces" type="number" min={0} max={100} defaultValue={L?.parkingSpaces ?? ""} /></F>}
            {!isPG && (
              <F label="Furnishing">
                <select className="field" name="furnishing" defaultValue={L?.furnishing ?? ""}>
                  <option value="">Not specified</option>
                  {FURNISHING.map((f) => <option key={f} value={f}>{label(f)}</option>)}
                </select>
              </F>
            )}
            <F label="Facing">
              <select className="field" name="facing" defaultValue={L?.facing ?? ""}>
                <option value="">Not specified</option>
                {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </F>
            <F label="Title deed number"><input className="field" name="titleDeedNumber" maxLength={50} autoComplete="off" defaultValue={L?.titleDeedNumber ?? ""} /></F>
            {!isPG && <F label="Handover date"><input className="field" name="handoverDate" type="date" defaultValue={L?.handoverDate ?? ""} /></F>}
          </Section>

          <Section id="rooms" title="Rooms" hint={multiRoom ? (isPG ? "Set the number of rooms per seater category, then manage their details in the room window." : "Add one entry per bedroom.") : "This property is rented as a single unit, using the Rent above."}>
            {isPG ? (
              <>
                <div className="sm:col-span-2 rounded-2xl bg-cream/60 p-4">
                  <p className="font-medium">Rooms per category</p>
                  <p className="mb-3 text-sm text-muted-foreground">Enter the number of rooms for each category (maximum 100 rooms total).</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: maxSeats }, (_, i) => i + 1).map((capacity) => (
                      <F key={capacity} label={`${capacity} seater rooms`}>
                        <input className="field" type="number" min={0} max={100} value={categoryCounts[capacity] ?? "0"} onChange={(e) => setCategoryCounts((v) => ({ ...v, [capacity]: e.target.value }))} />
                      </F>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Total: <strong className="text-foreground">{requestedRoomTotal}/100</strong></p>
                    <button type="button" onClick={generateRooms} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Generate / update rooms</button>
                  </div>
                </div>
                {catWarn && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive sm:col-span-2">{catWarn}</p>}
                {cats.map((capacity) => (
                  <div key={capacity} className="sm:col-span-2 rounded-2xl border border-cream p-4">
                    <div className="mb-3 flex items-center justify-between"><div><p className="font-medium">{capacity} seater room media</p><p className="text-xs text-muted-foreground">Shared by all {roomsUsing(capacity)} rooms in this category</p></div><span className="text-xs text-muted-foreground">{categoryMedia.filter((m) => m.capacity === capacity).length} files</span></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="cursor-pointer rounded-xl bg-cream px-4 py-3 text-center text-sm">Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addCategoryMedia(capacity, "IMAGE", e.target.files); e.target.value = ""; }} /></label>
                      <label className="cursor-pointer rounded-xl bg-cream px-4 py-3 text-center text-sm">Add videos<input type="file" accept="video/mp4,video/webm" multiple className="hidden" onChange={(e) => { addCategoryMedia(capacity, "VIDEO", e.target.files); e.target.value = ""; }} /></label>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {categoryMedia.filter((m) => m.capacity === capacity).map((media) => <div key={media.id ?? media.src} className="relative overflow-hidden rounded-xl bg-cream">
                        {media.mediaType === "IMAGE" ? <img src={media.src} alt={media.originalName} className="aspect-[4/3] w-full object-cover" /> : <video src={media.src} controls className="aspect-[4/3] w-full object-cover" />}
                        <button type="button" onClick={() => removeCategoryMediaItem(media)} className="absolute right-2 top-2 rounded-full bg-background p-1.5 text-destructive"><X className="h-4 w-4" /></button>
                        <p className="truncate px-2 py-1 text-xs">{media.originalName}</p>
                      </div>)}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Maximum 10 photos (5 MB each) and 5 videos (50 MB each).</p>
                  </div>
                ))}
                <div className="sm:col-span-2 flex items-center justify-between rounded-2xl bg-cream p-4"><div><p className="font-medium">{rooms.length} rooms generated</p><p className="text-sm text-muted-foreground">Room details open separately and are paginated.</p></div><button type="button" disabled={!rooms.length} onClick={() => setRoomManagerOpen(true)} className="rounded-full bg-background px-5 py-2.5 text-sm disabled:opacity-40">Manage rooms</button></div>
                {roomManagerOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
                  <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background">
                    <div className="flex items-center justify-between border-b border-cream p-5"><div><h3 className="text-xl font-medium">Manage PG rooms</h3><p className="text-sm text-muted-foreground">{rooms.length} rooms</p></div><button type="button" onClick={() => setRoomManagerOpen(false)} aria-label="Close"><X /></button></div>
                    <div className="flex flex-wrap gap-2 border-b border-cream p-4">{cats.map((c) => <button type="button" key={c} onClick={() => { setActiveRoomCategory(c); setRoomPage(0); }} className={`rounded-full px-4 py-2 text-sm ${activeRoomCategory === c ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{c} seater ({roomsUsing(c)})</button>)}</div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">{(() => {
                      const list = rooms.map((room, index) => ({ room, index })).filter(({ room }) => Number(room.capacity) === activeRoomCategory);
                      const pages = Math.max(1, Math.ceil(list.length / 10));
                      return <><div className="space-y-3">{list.slice(roomPage * 10, roomPage * 10 + 10).map(({ room, index }) => <div key={room.id ?? index} className="rounded-2xl bg-cream/60 p-4"><div className="grid gap-3 sm:grid-cols-3"><F label="Room name"><input className={sm} value={room.label} onChange={(e) => updateRoom(index, { label: e.target.value })} required /></F><F label="Rent per person / month (₹)"><input className={sm} type="number" min={0} value={room.rent} onChange={(e) => updateRoom(index, { rent: e.target.value })} required /></F><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Occupied {room.occupied}/{room.capacity}</span><label className="text-sm"><input type="checkbox" checked={room.ac} onChange={(e) => updateRoom(index, { ac: e.target.checked })} /> AC</label></div></div><div className="mt-2 text-right"><button type="button" disabled={Number(room.occupied) > 0} onClick={() => { setRooms((rs) => rs.filter((_, i) => i !== index)); setCategoryCounts((v) => ({ ...v, [activeRoomCategory]: String(Math.max(0, Number(v[activeRoomCategory] || 0) - 1)) })); if (roomsUsing(activeRoomCategory) <= 1) setCats((cs) => cs.filter((c) => c !== activeRoomCategory)); }} className="text-sm text-destructive disabled:opacity-40">Remove room</button></div></div>)}</div><div className="mt-4 flex items-center justify-between text-sm"><span>Page {roomPage + 1} of {pages}</span><div className="flex gap-2"><button type="button" disabled={roomPage === 0} onClick={() => setRoomPage((v) => Math.max(0, v - 1))} className="rounded-full bg-cream px-4 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={roomPage + 1 >= pages} onClick={() => setRoomPage((v) => Math.min(pages - 1, v + 1))} className="rounded-full bg-cream px-4 py-2 disabled:opacity-40">Next</button></div></div></>;
                    })()}</div>
                    <div className="flex justify-end border-t border-cream p-4"><button type="button" onClick={() => setRoomManagerOpen(false)} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground">Done</button></div>
                  </div>
                </div>}
              </>
            ) : (
              <>
                {rooms.map((r, i) => <div key={r.id ?? i} className="rounded-2xl bg-cream/60 p-4 sm:col-span-2"><div className="grid gap-3 sm:grid-cols-3"><F label="Name"><input className={sm} value={r.label} onChange={(e) => updateRoom(i, { label: e.target.value })} required /></F><F label="Sharing between"><select className={sm} value={r.capacity} onChange={(e) => updateRoom(i, { capacity: e.target.value })}>{Array.from({ length: maxSeats }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{`${n} ${n === 1 ? "person" : "people"}`}</option>)}</select></F><F label="Rent per person / month (₹)"><input className={sm} type="number" min={0} value={r.rent} onChange={(e) => updateRoom(i, { rent: e.target.value })} required /></F></div><div className="mt-3 flex justify-end"><button type="button" disabled={Number(r.occupied) > 0} onClick={() => setRooms((rs) => rs.filter((_, idx) => idx !== i))} className="text-sm text-destructive disabled:opacity-40">Remove room</button></div></div>)}
                <button type="button" onClick={addRoom} className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"><Plus className="h-4 w-4" />Add room</button>
              </>
            )}
            <p className="rounded-2xl bg-cream p-4 text-sm text-muted-foreground sm:col-span-2">
              Occupancy: <strong className="text-foreground">{totalOcc}/{totalCap}</strong> {totalOcc >= totalCap ? "· no vacancy" : `· ${totalCap - totalOcc} available`}
            </p>
          </Section>

          <Section id="rent" title="Rent & size" hint={isPG ? "PG rent is set per room in the Rooms section." : undefined}>
            {isPG ? (
              <div className="rounded-2xl bg-cream p-5 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Rent per person / month</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">
                  {minRent ? (minRent === maxRent ? inr(minRent) : `${inr(minRent)} – ${inr(maxRent)}`) : "Add rooms to set the rent"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">The lowest room rent is shown as the listing price.</p>
              </div>
            ) : (
              <F label="Rent (₹ / month)"><input className="field" name="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Enter monthly rent" /></F>
            )}
            <F label="Service charge (₹ / year)"><input className="field" name="serviceCharge" type="number" min={0} defaultValue={L?.serviceCharge ?? ""} placeholder="Annual service charge" /></F>
            <F label="Built-up area (m²)"><input className="field" name="builtUpAreaSqm" type="number" min={0} step="any" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Enter area" /></F>
            {!isPG && <F label="Rent per m²"><div className="field text-muted-foreground">{perSqm != null ? inr(perSqm) : "Calculated automatically"}</div></F>}
          </Section>

          {isPG ? (
            <Section id="layout" title="Bathrooms" hint="For each room category, choose whether the bathroom is attached to the room or shared (common).">
              {cats.length === 0 && <p className="rounded-2xl bg-cream/60 px-5 py-6 text-center text-sm text-muted-foreground sm:col-span-2">Select room categories in the Rooms section first.</p>}
              {cats.map((c) => {
                const cur = pgBath[c] ?? "Attached";
                return (
                  <div key={c} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/60 p-4 sm:col-span-2">
                    <span>
                      <span className="block font-medium">{c} seater rooms</span>
                      <span className="text-xs text-muted-foreground">{roomsUsing(c)} {roomsUsing(c) === 1 ? "room" : "rooms"} added</span>
                    </span>
                    <div className="flex rounded-full bg-background p-1">
                      {(["Attached", "Common"] as Bath[]).map((b) => (
                        <button key={b} type="button" aria-pressed={cur === b} onClick={() => setPgBath((m) => ({ ...m, [c]: b }))} className={`rounded-full px-5 py-2 text-sm transition-colors ${cur === b ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{b}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Section>
          ) : (
            <Section id="layout" title="Room & bathroom layout" hint="Describes the property for listings. Rentable rooms are managed above.">
              <div className="sm:col-span-2"><p className="px-1 text-sm text-muted-foreground">Rooms</p></div>
              <PairList rows={roomLayout} onChange={setRoomLayout} aLabel="Room type" bLabel="Size (m²)" addLabel="Add room" aOptions={ROOM_TYPES} />
              <div className="sm:col-span-2"><p className="px-1 text-sm text-muted-foreground">Bathrooms</p></div>
              <PairList rows={bathLayout} onChange={setBathLayout} aLabel="Bathroom type" bLabel="Area (m²)" addLabel="Add bathroom" aOptions={BATH_TYPES} />
            </Section>
          )}

          <Section id="amenities" title="Amenities" hint="Tap to select what applies, or add your own.">
            <TagPicker label="Amenities" presets={AMENITY_PRESETS} value={amenities} onChange={setAmenities} />
            <TagPicker label="Features & finishes" presets={FEATURE_PRESETS} value={features} onChange={setFeatures} />
          </Section>

          <Section id="location" title="Location">
            <F label="Address" wide><input className="field" name="address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, landmark" /></F>
            <MapPicker address={address} city={city} lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
            <div className="sm:col-span-2"><p className="px-1 text-sm text-muted-foreground">Nearby places</p></div>
            <PairList rows={nearby} onChange={setNearby} aLabel="Place" bLabel="Distance (km)" addLabel="Add place" />
          </Section>

          <Section id="listed-by" title="Listed by">
            {owners && !editing ? (
              <>
                <div className="grid gap-1 rounded-2xl bg-cream p-5 sm:col-span-2">
                  <p className="font-medium">Listed by {PLATFORM_LISTER}</p>
                  {ownerName
                    ? <p className="text-sm">Owned by <strong>{ownerName}</strong></p>
                    : <p className="text-sm text-muted-foreground">Listed directly by the platform. Assign an owner below if this property belongs to a Property Admin.</p>}
                </div>
                <F label="Primary owner (optional)" wide>
                  <select className="field" name="ownerId" value={ownerId} onChange={(e) => { setOwnerId(e.target.value); if (e.target.value === coOwnerId) setCoOwnerId(""); }}>
                    <option value="">No owner (platform-owned)</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </F>
                <F label="Co-owner (optional)" wide>
                  <select className="field" name="coOwnerId" value={coOwnerId} onChange={(e) => setCoOwnerId(e.target.value)}>
                    <option value="">No co-owner</option>
                    {owners.filter((o) => o.id !== ownerId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">Choose a registered Property Admin. A primary owner must also be selected before assigning a co-owner.</span>
                </F>
              </>
            ) : (
              <div className="rounded-2xl bg-cream p-5 sm:col-span-2">
                {listedBy ? (
                  <div className="grid gap-1">
                    <p className="font-medium">{listedBy.title}</p>
                    {listedBy.subtitle && <p className="text-sm text-muted-foreground">{listedBy.subtitle}</p>}
                    {listedBy.phone && <p className="text-sm">Phone: {listedBy.phone}</p>}
                    {listedBy.email && <p className="text-sm">Email: {listedBy.email}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">After saving, this shows the Property Management Team.</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">Taken from the owner&apos;s account. To change it, update the owner&apos;s profile.</p>
              </div>
            )}
          </Section>

          <Section id="visibility" title="Visibility">
            <ToggleRow title="Published" desc="Visible to the public once approved." name="isPublished" defaultChecked={L?.isPublished ?? true} disabled={!can("isPublished")} />
            <ToggleRow title="Featured property" desc={can("featured") ? "Marks the property as featured. Saved with the property, but no listing page reads it yet." : "Only a Super Admin can change this."} name="featured" defaultChecked={L?.featured ?? false} disabled={!can("featured")} />
          </Section>

          <Section id="documents" title="Documents" hint="PDF, JPG, PNG or WebP, up to 10 MB each.">
            {(editing ? initial?.authorityProof !== undefined : !owners) && (
              <>
                <div className="sm:col-span-2">
                  <p className="font-medium">Ownership proof</p>
                  <p className="text-sm text-muted-foreground">Sale deed, property tax receipt, lease or power of attorney. Reviewed separately from your account KYC.</p>
                </div>
                {editing && (
                  <p className="rounded-2xl bg-cream p-4 text-sm sm:col-span-2">
                    {initial?.authorityProof
                      ? <>On file: <a className="text-primary hover:underline" href={`/api/property-authority/${initial.id}`} target="_blank" rel="noreferrer">{initial.authorityProof.name}</a>. Choose a file only to replace it.</>
                      : "No ownership proof on file."}
                  </p>
                )}
                <FileDrop name="authorityProof" accept="application/pdf,image/jpeg,image/png,image/webp" title={editing ? "Replace ownership proof" : "Upload ownership proof (required for your first property)"} hint="PDF, JPG, PNG or WebP · up to 10 MB" />
                <div className="border-t border-cream pt-4 sm:col-span-2"><p className="font-medium">Legal documents</p></div>
              </>
            )}

            {initial && initial.documents.length > 0 && (
              <ul className="space-y-2 sm:col-span-2">
                {initial.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-primary"><FileText className="h-5 w-5" /></span>
                    <a href={`/api/uploads/${d.path}`} target="_blank" rel="noreferrer" className={`min-w-0 flex-1 truncate hover:underline ${removeDocs.includes(d.id) ? "line-through opacity-60" : ""}`}>{d.name}</a>
                    <button type="button" className="shrink-0 rounded-full bg-background px-4 py-1.5 hover:text-destructive" onClick={() => setRemoveDocs((l) => toggle(l, d.id))}>
                      {removeDocs.includes(d.id) ? "Undo" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {docRows.map((key) => (
              <div key={key} className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                  <F label="Document name"><input className={sm} name="docName" placeholder="e.g. Sale deed, NOC, Tax receipt" /></F>
                  <FileDrop name="docFile" wide={false} accept="application/pdf,image/jpeg,image/png,image/webp" title="Choose a file" hint="PDF or image · up to 10 MB" />
                  <button type="button" aria-label="Remove document" onClick={() => setDocRows((r) => r.filter((k) => k !== key))} className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            <button type="button" className="flex w-fit items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-muted" onClick={() => setDocRows((r) => [...r, (r[r.length - 1] ?? 0) + 1])}>
              <Plus className="h-4 w-4" />Add document
            </button>
          </Section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-[1.75rem] bg-background p-3">
            <p className="px-2 pb-3 text-sm text-muted-foreground">Card preview</p>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-cream">
              {gallery[0] ? <img src={gallery[0].src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus className="h-8 w-8" /></div>}
              {L?.featured && <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background text-primary"><Star className="h-4 w-4 fill-current" /></span>}
            </div>
            <div className="p-3">
              <p className="text-2xl font-medium tracking-tight">
                {isPG ? (minRent ? `From ${inr(minRent)}` : "₹ —") : Number(price) > 0 ? inr(Number(price)) : "₹ —"}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 font-medium">{title || "Property title"}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{city || "City"}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{short || "Short description appears here."}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <span className="flex items-center gap-1.5"><Maximize className="h-4 w-4 text-primary" />{area || 0} m²</span>
                {!isPG && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" />{beds || 0}</span>}
                <span className="flex items-center gap-1.5"><BathIcon className="h-4 w-4 text-primary" />{baths || 0}</span>
              </div>
            </div>
            <button disabled={busy} className="mt-2 w-full rounded-full bg-primary py-3.5 text-primary-foreground hover:bg-ink disabled:opacity-60">
              {busy ? "Saving…" : editing ? "Update property" : "Create property"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
