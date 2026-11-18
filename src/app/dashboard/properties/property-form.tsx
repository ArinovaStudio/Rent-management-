"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bath as BathIcon, BedDouble, ChevronLeft, ChevronRight, FileText, ImagePlus, MapPin, Maximize, Plus, Star, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import MapPicker from "./map-picker";
import NearbyPlaces from "./nearby-places";
import { F, FileDrop, Section, SavingOverlay, TagPicker, ToggleRow, toPairs, type Pair } from "./property-sections";
import {
  FURNISHING, FACING, AMENITY_PRESETS, FEATURE_PRESETS,
  PLATFORM_LISTER, label, type ListingClient, type ListedBy
} from "@/lib/property-fields";
import { canWriteField } from "@/lib/permissions";
import type { Role } from "@/lib/jwt";
import { propertiesBase } from "@/lib/routes";
import { blankRoom, sm, type CategoryMedia, type RoomState } from "./room-types";
import FloorGeneratorModal from "./floor-generator";
import CategoryMediaModal from "./room-generator";
import PgCategoriesCard from "./pg-categories";
import { buildPgRooms, planFromRooms } from "./pg-plan";
import { catKey, floorBaths, fromStored, planIssues, sameCat, splitEvenly, toStored, type PgCategory, type PgFloor, type PgPlan } from "@/lib/pg-config";
import BedroomConfigModal from "./bedroom-config";
import { BedroomsCard, PgRoomsCard, PropertySummary } from "./config-summary";

type GalleryItem = { key: string; src: string; id?: string; file?: File };
type PType = "PG" | "APARTMENT" | "FLAT";

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
  pgConfig?: unknown;
  sharing: boolean;
  rooms: { id: string; label: string; capacity: number; ac: boolean; rent: number; occupied: number; floor: number | null; roomType?: string | null; sizeSqm?: number | null; bathroomAttached?: boolean; bathroomAreaSqm?: number | null; images?: string[] }[];
  images: { id: string; path: string }[];
  categoryMedia?: { id: string; capacity: number; mediaType: "IMAGE" | "VIDEO"; path: string; originalName: string }[];
  documents: { id: string; name: string; path: string }[];
  listing?: ListingClient;
  // Only set for a Property Admin editing their own property: shows the ownership proof section.
  authorityProof?: { name: string } | null;
  totalRooms?: number | null;
};

const NAV = [["Photos & video", "photos"], ["Basics", "basics"], ["Description", "description"], ["Specifications", "specifications"], ["Rooms", "rooms"], ["Rent & size", "rent"], ["Amenities", "amenities"], ["Location", "location"], ["Listing", "listing"], ["Documents", "documents"]] as const;
const TYPE_OPTIONS: [PType, string, string][] = [
  ["PG", "PG", "Rooms shared by several people"],
  ["FLAT", "Flat / Apartment", "A flat, apartment or independent floor"],
];

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
  // `sharing` = rent is set per room category (rooms are rented one by one, like a PG).
  const [sharing, setSharing] = useState(initial?.sharing ?? false);
  // `shared` = several people live in this flat. Without rent by category the whole flat has one rent and we only
  // record how many people live in it (saved as a single unit that holds that many people).
  const [shared, setShared] = useState(initial ? initial.sharing || (single?.capacity ?? 1) > 1 : false);
  const [persons, setPersons] = useState(() => {
    if (!initial) return "2";
    if (initial.sharing) return String(Math.max(2, initial.rooms.reduce((sum, r) => sum + r.capacity, 0)));
    return String(Math.max(2, single?.capacity ?? 2));
  });
  // Rooms as saved. PG rooms are generated from the plan below (existing rooms are kept, so residents stay);
  // rooms of sharing flats / apartments are edited directly in `sharedRooms`.
  const [initialRooms] = useState<RoomState[]>(() =>
    (initial?.rooms ?? []).map((r) => ({
      id: r.id, label: r.label, capacity: String(r.capacity), ac: r.ac,
      rent: String(r.rent), occupied: String(r.occupied), floor: r.floor == null ? "" : String(r.floor),
      roomType: r.roomType ?? "Bedroom",
      sizeSqm: r.sizeSqm != null ? String(r.sizeSqm) : "",
      bathAttached: r.bathroomAttached ?? true,
      bathArea: r.bathroomAreaSqm != null ? String(r.bathroomAreaSqm) : "",
      photos: (r.images ?? []).map((p) => ({ key: p, path: p, src: `/api/uploads/${p}` })),
    }))
  );
  const [sharedRooms, setRooms] = useState<RoomState[]>(initialRooms);
  // PG plan: categories offered (with rent) and, per floor, rooms / bathrooms / categories / rent adjustment
  const [plan, setPlan] = useState<PgPlan>(() => fromStored(initial?.pgConfig) ?? planFromRooms(initialRooms));
  // Which configuration popup is open (floor generator, category media, or the apartment/flat room cards)
  const [modal, setModal] = useState<null | "floors" | "media" | "bedrooms">(null);
  const [categoryMedia, setCategoryMedia] = useState<CategoryMedia[]>(() =>
    (initial?.categoryMedia ?? []).map((m) => ({ ...m, src: `/api/uploads/${m.path}` }))
  );
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const L = initial?.listing;
  const can = (f: string) => canWriteField(role, f);
  const base = propertiesBase(role);
  const [price, setPrice] = useState(L?.price != null ? String(L.price) : "");
  const [area, setArea] = useState(L?.builtUpAreaSqm != null ? String(L.builtUpAreaSqm) : "");
  // Whole-unit (non-sharing) properties describe their rooms here; saved into the listing layout fields
  const [unitRooms, setUnitRooms] = useState<RoomState[]>(() => {
    if (initial?.sharing) return [];
    const rl = toPairs(L?.roomLayout, "type", "size");
    const bl = toPairs(L?.bathroomLayout, "type", "size");
    return rl.map((p, i) => {
      const m = /^(.*) \((.*)\)$/.exec(p.a);
      const b = /^.* – (Attached|Common)$/.exec(bl[i]?.a ?? "");
      return { ...blankRoom(m ? m[1] : p.a), roomType: m ? m[2] : "Bedroom", sizeSqm: p.b, bathAttached: b ? b[1] === "Attached" : true, bathArea: bl[i]?.b ?? "" };
    });
  });
  const [floorsN, setFloorsN] = useState(initial?.floors != null ? String(initial.floors) : "");
  const [mapFocus, setMapFocus] = useState<string | null>(null);
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
  const floorCount = isPG ? Math.max(0, Math.floor(Number(floorsN)) || 0) : 0;
  const pgBuilt = useMemo(() => buildPgRooms(plan, floorCount, initialRooms), [plan, floorCount, initialRooms]);
  const rooms = isPG ? pgBuilt.rooms : sharedRooms;
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
  const roomsUsing = (n: number) => rooms.filter((r) => Number(r.capacity) === n).length;
  const cats = Array.from(new Set(rooms.map((r) => Number(r.capacity)))).sort((a, b) => a - b);
  const declaredRooms = isPG ? 0 : Number(beds) || 0;
  const activeRooms = multiRoom ? rooms.length : unitRooms.length;
  const remaining = declaredRooms > 0 ? declaredRooms - activeRooms : null;
  const atLimit = remaining !== null && remaining <= 0;
  const floorList = Array.from({ length: floorCount }, (_, i) => i + 1);
  const pgBaths = floorList.reduce((sum, f) => { const p = plan.floors.find((x) => x.floor === f); return sum + (p ? floorBaths(p, plan.categories) : 0); }, 0);
  const pgIssues = [...planIssues(plan, floorCount), ...pgBuilt.errors];
  const roomsByKey: Record<string, number> = {};
  rooms.forEach((r) => { const k = catKey({ capacity: Number(r.capacity), ac: r.ac }); roomsByKey[k] = (roomsByKey[k] ?? 0) + 1; });

  // Ticking / unticking a category: floors lose the categories that are no longer offered and re-split their rooms
  const setCategories = (next: PgCategory[]) => setPlan((p) => ({
    categories: next,
    floors: p.floors.map((f) => {
      const cats = f.cats.filter((c) => next.some((n) => sameCat(n, c)));
      if (cats.length === f.cats.length) return f;
      const parts = splitEvenly(Number(f.rooms) || 0, cats.length);
      return { ...f, cats: cats.map((c, i) => ({ ...c, qty: String(parts[i]) })) };
    }),
  }));

  // The popups edit a draft copy. These apply it to the form when the admin presses Save.
  const saveFloors = (floors: PgFloor[]) => { setPlan((p) => ({ ...p, floors })); setModal(null); };
  const saveMedia = (media: CategoryMedia[]) => { setCategoryMedia(media); setModal(null); };
  const saveBedrooms = (next: RoomState[]) => { (sharing ? setRooms : setUnitRooms)(next); setModal(null); };

  const personsN = Math.floor(Number(persons)) || 0;
  const wholeCap = shared ? Math.max(1, personsN) : 1;
  const singleOcc = Math.min(single?.occupied ?? 0, wholeCap);
  const totalCap = multiRoom ? rooms.reduce((s, r) => s + Number(r.capacity || 0), 0) : wholeCap;
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
    if (isPG) {
      if (floorCount < 1) return stop("Enter the number of floors in Specifications.");
      const issue = pgIssues[0];
      if (issue) return stop(issue);
    }
    if (multiRoom && rooms.length === 0) return stop("Add at least one room.");
    if (!isPG && shared && (personsN < 2 || personsN > 20)) return stop("Enter how many people live in this flat (2 to 20).");
    if (multiRoom && !isPG && declaredRooms < 1) return stop("Enter the number of bedrooms in Specifications.");
    if (multiRoom && !isPG && totalCap > personsN) return stop(`Your rooms hold ${totalCap} people but you said ${personsN} live here. Raise the number of persons or reduce the room sharing.`);
    if (multiRoom && !isPG && rooms.length > declaredRooms) return stop(`You declared ${declaredRooms} rooms but added ${rooms.length}.`);
    if (multiRoom) {
      // Room names and rents are edited in the popups, outside the form, so they are checked here
      const incomplete = rooms.find((r) => !r.label.trim() || r.rent.trim() === "");
      if (incomplete) return stop(`${incomplete.label.trim() || "A room"}: enter a room name and rent (open the room configuration to fix it).`);
    }
    if (!isPG) {
      const bad = (sharing ? rooms : unitRooms).find((r) => !(Number(r.sizeSqm) > 0) || !(Number(r.bathArea) > 0));
      if (bad) return stop(`${bad.label}: enter the room size and the ${bad.bathAttached ? "bathroom" : "common washroom"} area.`);
    }
    const liveMedia = categoryMedia.filter((m) => cats.includes(m.capacity));

    const payload = multiRoom
      ? rooms.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, ac: r.ac, rent: r.rent, occupied: r.occupied, floor: r.floor, roomType: r.roomType, sizeSqm: r.sizeSqm, bathroomAttached: r.bathAttached, bathroomAreaSqm: r.bathArea, images: r.photos.filter((p) => p.path).map((p) => p.path) }))
      // A single unit's rent is the Rent field (falls back to what was saved before)
      : [{ id: single?.id, label: "Entire property", capacity: wholeCap, ac: false, rent: Number(price) > 0 ? price : String(single?.rent ?? 0), occupied: singleOcc }];
    fd.set("rooms", JSON.stringify(payload));
    // PG: the plan is saved with the property so it can be edited again; totals come from the floors
    fd.set("pgConfig", isPG ? JSON.stringify(toStored(plan, floorCount)) : "{}");
    if (isPG) { fd.set("bathrooms", String(pgBaths)); fd.set("totalRooms", String(rooms.length)); }
    rooms.forEach((_, i) => fd.delete(`roomImages_${i}`));
    if (!isPG && sharing) rooms.forEach((r, i) => r.photos.forEach((p) => { if (p.file) fd.append(`roomImages_${i}`, p.file); }));
    fd.set("latitude", lat);
    fd.set("longitude", lng);
    // PG rent is per room: the listing price is the lowest room rent
    if (multiRoom) fd.set("price", minRent ? String(minRent) : "");
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
    if (isPG) liveMedia.forEach((media) => {
      if (media.file) fd.append(`categoryMedia_${media.capacity}_${media.mediaType === "IMAGE" ? "images" : "videos"}`, media.file);
    });
    fd.set("removeCategoryMediaIds", JSON.stringify((initial?.categoryMedia ?? []).filter((m) => !liveMedia.some((current) => current.id === m.id)).map((m) => m.id)));
    const asRows = (rows: Pair[], a: string, b: string) => JSON.stringify(rows.filter((r) => r.a.trim() || r.b).map((r) => ({ [a]: r.a, [b]: r.b })));
    if (isPG) {
      fd.set("roomLayout", "[]");
      fd.set("bathroomLayout", "[]"); // PG bathrooms are counted per floor (see pgConfig)
    } else {
      const cards = sharing ? rooms : unitRooms;
      fd.set("roomLayout", JSON.stringify(cards.map((r) => ({ type: r.roomType && r.roomType !== "Bedroom" ? `${r.label} (${r.roomType})` : r.label, size: r.sizeSqm }))));
      fd.set("bathroomLayout", JSON.stringify(cards.map((r) => ({ type: `${r.label} – ${r.bathAttached ? "Attached" : "Common"}`, size: r.bathArea }))));
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

      {modal === "floors" && <FloorGeneratorModal floorCount={floorCount} plan={plan} baseRooms={initialRooms} onSave={saveFloors} onClose={() => setModal(null)} />}
      {modal === "media" && <CategoryMediaModal categories={cats.map((c) => ({ capacity: c, rooms: roomsUsing(c) }))} categoryMedia={categoryMedia} onSave={saveMedia} onClose={() => setModal(null)} />}
      {modal === "bedrooms" && <BedroomConfigModal sharing={sharing} cards={sharing ? rooms : unitRooms} declaredRooms={declaredRooms} maxSeats={maxSeats} onSave={saveBedrooms} onClose={() => setModal(null)} />}

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
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPE_OPTIONS.map(([v, t, hint]) => (
                  <label key={v} className="cursor-pointer">
                    {/* Flat and Apartment are one option now; older "APARTMENT" properties show it as selected */}
                    <input type="radio" name="type" value={v} checked={v === "PG" ? type === "PG" : type !== "PG"} onChange={() => setType(v)} className="peer sr-only" />
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
              <>
                <ToggleRow title="Shared flat" desc="Friends or flatmates will live here together." name="sharedLiving" checked={shared} onChange={(e) => { setShared(e.target.checked); if (!e.target.checked) setSharing(false); }} />
                {shared && (
                  <>
                    <F label="Number of persons"><input className="field" type="number" min={2} max={20} value={persons} onChange={(e) => setPersons(e.target.value)} placeholder="e.g. 3" /></F>
                    <ToggleRow title="Set rent by room category" desc="On: give each room its own rent (e.g. AC and non-AC differ) and allocate tenants by room category, like a PG. Off: the whole flat has one rent and we only record how many people live in it." name="sharing" checked={sharing} onChange={(e) => setSharing(e.target.checked)} />
                  </>
                )}
              </>
            )}
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
            {!isPG && <F label={sharing ? "Bedrooms (limit for rooms you add)" : "Bedrooms"}><input className="field" name="bedrooms" type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="Number of bedrooms" /></F>}
            {!isPG && <F label="Bathrooms"><input className="field" name="bathrooms" type="number" min={0} value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="Number of bathrooms" /></F>}
            {isPG
              ? <F label="Number of floors"><input className="field" name="floors" type="number" min={0} value={floorsN} onChange={(e) => setFloorsN(e.target.value)} /></F>
              : floorsN !== "" && <input type="hidden" name="floors" value={floorsN} />}
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
            <F label="Year built"><input className="field" name="yearBuilt" type="number" min={1800} max={new Date().getFullYear() + 10} defaultValue={L?.yearBuilt ?? ""} placeholder="e.g. 2022" /></F>
            <F label="Developer"><input className="field" name="developer" maxLength={120} defaultValue={L?.developer ?? ""} placeholder="Enter developer name" /></F>
            {!isPG && <PropertySummary isPG={false} floorCount={0} declaredRooms={declaredRooms} rooms={rooms} cards={sharing ? rooms : unitRooms} beds={beds} baths={baths} plan={plan} />}
          </Section>

          <Section id="rooms" title={isPG ? "Floors & rooms" : "Room Configuration"} hint={isPG ? "Pick your room categories and rent, then generate the floors. Rooms are created automatically with their names and rent." : sharing ? "Configure each bedroom in the popup: sharing, size, type, bathroom, rent and photos." : "Describe each room of the unit in the popup. The whole property is rented using the Rent below."}>
            {!isPG && (multiRoom || declaredRooms > 0) && (
              <div className="flex items-center justify-between rounded-2xl bg-cream p-4 text-sm sm:col-span-2">
                <span>
                  {declaredRooms > 0
                    ? <><strong>{activeRooms}</strong> of <strong>{declaredRooms}</strong> rooms configured</>
                    : "Enter the number of bedrooms in Specifications to start."}
                </span>
                {declaredRooms > 0 && <span className={atLimit ? "text-destructive" : "text-muted-foreground"}>{atLimit ? "Limit reached" : `${remaining} remaining`}</span>}
              </div>
            )}
            {isPG ? (
              <>
                <PgCategoriesCard categories={plan.categories} roomsByKey={roomsByKey} onChange={setCategories} />
                <PgRoomsCard floorCount={floorCount} hasCategories={plan.categories.length > 0} rooms={rooms} categoryMedia={categoryMedia} issues={pgIssues} onFloors={() => setModal("floors")} onMedia={() => setModal("media")} />
              </>
            ) : (
              <BedroomsCard sharing={sharing} cards={sharing ? rooms : unitRooms} declaredRooms={declaredRooms} onOpen={() => setModal("bedrooms")} />
            )}
            <p className="rounded-2xl bg-cream p-4 text-sm text-muted-foreground sm:col-span-2">
              {multiRoom
                ? <>Occupancy: <strong className="text-foreground">{totalOcc}/{totalCap}</strong> {totalOcc >= totalCap ? "· no vacancy" : `· ${totalCap - totalOcc} available`}</>
                : <>Rented as one whole flat · holds <strong className="text-foreground">{wholeCap}</strong> {wholeCap === 1 ? "person" : "people"}</>}
            </p>
            {isPG && <PropertySummary isPG floorCount={floorCount} declaredRooms={0} rooms={rooms} cards={[]} beds={beds} baths={baths} plan={plan} />}
          </Section>

          <Section id="rent" title="Rent & size" hint={multiRoom ? (isPG ? "Rent is set per category (and per floor) in the Rooms section." : "Rent is set per room in the Rooms section.") : undefined}>
            {multiRoom ? (
              <div className="rounded-2xl bg-cream p-5 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Rent per person / month</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">
                  {minRent ? (minRent === maxRent ? inr(minRent) : `${inr(minRent)} – ${inr(maxRent)}`) : "Add rooms to set the rent"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">The lowest room rent is shown as the listing price.</p>
              </div>
            ) : (
              <F label={shared ? "Rent for the whole flat (₹ / month)" : "Rent (₹ / month)"}><input className="field" name="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Enter monthly rent" /></F>
            )}
            <F label="Service charge (₹ / year)"><input className="field" name="serviceCharge" type="number" min={0} defaultValue={L?.serviceCharge ?? ""} placeholder="Annual service charge" /></F>
            <F label="Built-up area (m²)"><input className="field" name="builtUpAreaSqm" type="number" min={0} step="any" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Enter area" /></F>
            {!multiRoom && <F label="Rent per m²"><div className="field text-muted-foreground">{perSqm != null ? inr(perSqm) : "Calculated automatically"}</div></F>}
          </Section>

          <Section id="amenities" title="Amenities" hint="Tap to select what applies, or add your own.">
            <TagPicker label="Amenities" presets={AMENITY_PRESETS} value={amenities} onChange={setAmenities} />
            <TagPicker label="Features & finishes" presets={FEATURE_PRESETS} value={features} onChange={setFeatures} />
          </Section>

          <Section id="location" title="Location">
            <F label="Address" wide><input className="field" name="address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, landmark" /></F>
            <F label="City"><input className="field" name="city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" /></F>
            <F label="District"><input className="field" name="district" maxLength={80} defaultValue={L?.district ?? ""} placeholder="Enter district" /></F>
            <F label="State"><input className="field" name="state" maxLength={80} defaultValue={L?.state ?? ""} placeholder="Enter state" /></F>
            <MapPicker address={address} city={city} lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} focus={mapFocus} onClearFocus={() => setMapFocus(null)} />
            <div className="border-t border-cream pt-4 sm:col-span-2">
              <p className="font-medium">Nearby places</p>
              <p className="text-sm text-muted-foreground">Schools, hospitals, transport and more, with the distance from the property.</p>
            </div>
            <NearbyPlaces rows={nearby} onChange={setNearby} onFocus={setMapFocus} />
          </Section>

          <Section id="listing" title="Listing & visibility">
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
            {!editing && role === "PROPERTY_ADMIN" && (
              <F label="Co-owner email (optional)" wide>
                <input className="field" name="coOwnerEmail" type="email" placeholder="coowner@example.com" autoComplete="off" />
                <span className="text-xs text-muted-foreground">The co-owner must already be a verified Property Admin. They&apos;ll be asked to upload their own proof documents.</span>
              </F>
            )}
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
                {multiRoom ? (minRent ? `From ${inr(minRent)}` : "₹ —") : Number(price) > 0 ? inr(Number(price)) : "₹ —"}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 font-medium">{title || "Property title"}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{city || "City"}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{short || "Short description appears here."}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <span className="flex items-center gap-1.5"><Maximize className="h-4 w-4 text-primary" />{area || 0} m²</span>
                {!isPG && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" />{beds || 0}</span>}
                <span className="flex items-center gap-1.5"><BathIcon className="h-4 w-4 text-primary" />{isPG ? pgBaths : baths || 0}</span>
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