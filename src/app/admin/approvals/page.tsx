import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Check, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "../ui";
import ApproveButton from "../approve-button";
import PropertyFilterBar from "@/components/admin/PropertyFilterBar";
import { TYPE_OPTIONS, applyPropertyFilters, hasFilters, splitFilter } from "@/lib/property-filter";

// Status choices now live inside the Filter panel. Opens on "Awaiting approval" unless the person picks another.
const STATUS_FILTER = [
  { value: "PENDING", label: "Awaiting approval" },
  { value: "NEEDS_MORE_INFO", label: "Needs more information" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];
// Old links used ?filter=pending|info|approved|rejected. Send them to ?status=.
const LEGACY: Record<string, string> = { pending: "PENDING", info: "NEEDS_MORE_INFO", approved: "APPROVED", rejected: "REJECTED" };
const LABEL = { PENDING: "Awaiting approval", NEEDS_MORE_INFO: "More information needed", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const TYPE = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;

export default async function PropertyApprovals({ searchParams }: { searchParams: Promise<{ filter?: string; status?: string; q?: string; type?: string }> }) {
  const me = await requireSuperAdmin();
  const { filter, status, q, type } = await searchParams;
  if (filter && !status && LEGACY[filter]) redirect(`/admin/approvals?status=${LEGACY[filter]}`);
  // No status in the URL = "Awaiting approval". status=all = every status. Comma list = multi-select.
  const allowed = new Set(STATUS_FILTER.map((o) => o.value));
  const statusList =
    status === "all" ? undefined
    : !status ? (["PENDING"] as const)
    : (splitFilter(status).filter((s) => allowed.has(s)) as ("PENDING" | "NEEDS_MORE_INFO" | "APPROVED" | "REJECTED")[]);
  const statusWhere = !statusList ? {} : statusList.length === 1 ? { status: statusList[0] } : statusList.length > 1 ? { status: { in: statusList } } : { status: "PENDING" as const };

  const allProperties = await prisma.property.findMany({
    where: statusWhere,
    include: {
      owner: { select: { name: true } },
      authorityProof: { select: { id: true } },
      rooms: { select: { rent: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { path: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  const filters = { q, type };
  const properties = applyPropertyFilters(allProperties, filters);
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="Property approvals" sub="Review new and updated listings before they go live." />
      <PropertyFilterBar
        groups={[
          { key: "status", label: "Status", options: STATUS_FILTER, defaultValue: "PENDING" },
          { key: "type", label: "Property type", options: TYPE_OPTIONS },
        ]}
      />
      {properties.length === 0 ? (
        <Panel><p className="text-muted-foreground">{allProperties.length > 0 && hasFilters(filters) ? "No properties match your search or filters." : "Nothing here."}</p></Panel>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const cover = p.images[0]?.path;
            const rents = p.rooms.map((r) => r.rent).filter((n) => n > 0);
            const rentText = rents.length ? (Math.min(...rents) === Math.max(...rents) ? inr(rents[0]) : `${inr(Math.min(...rents))}+`) : "—";
            const unitWord = p.type === "BUILDING" ? "Flats" : p.type === "PG" ? "Rooms" : "Units";
            const typeText = `${TYPE[p.type]}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`;
            return (
              <div key={p.id} className="group relative flex flex-col rounded-[1.75rem] bg-background p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {/* Whole card opens the review page. The two buttons sit above it and show on hover. */}
                <Link href={`/admin/approvals/${p.id}`} aria-label={`Review ${p.name}`} className="absolute inset-0 z-0 rounded-[1.75rem]" />

                <div className="pointer-events-none relative h-44 overflow-hidden rounded-2xl bg-cream">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${cover}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground"><Building2 className="h-12 w-12" /></div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Chip tone={toneFor(p.status)}>{LABEL[p.status]}</Chip>
                  </div>
                </div>

                <div className="pointer-events-none relative mt-4 flex flex-1 flex-col">
                  <h2 className="truncate text-xl font-semibold">{p.name}</h2>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{typeText} · {p.city}</p>
                  <p className="truncate text-sm text-muted-foreground">Owner: {p.owner.name}</p>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{p.description || `${p.address}, ${p.city}`}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">{unitWord}</p><p className="text-base font-semibold">{p.rooms.length}</p></div>
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">Proof</p><p className="text-base font-semibold">{p.authorityProof ? "Yes" : "None"}</p></div>
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">Rent / mo</p><p className="truncate text-base font-semibold">{rentText}</p></div>
                  </div>
                </div>

                {/* Hover only on large screens. On touch screens there is no hover, so the buttons stay visible. */}
                <div className="relative z-10 mt-4 flex items-center justify-between gap-3 transition-opacity duration-200 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                  {p.status === "APPROVED"
                    ? <span className="flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary"><Check className="h-4 w-4" />Approved</span>
                    : <ApproveButton propertyId={p.id} />}
                  <Link href={`/admin/approvals/${p.id}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ink-foreground transition-colors hover:bg-primary">Display information</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}