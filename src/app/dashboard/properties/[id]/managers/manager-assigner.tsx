"use client";
import { useState } from "react";
import Image from "next/image";
import { BadgeCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";
import { MAX_CO_OWNERS, MAX_MANAGERS } from "@/lib/team-limits";
import { Panel } from "@/components/admin/AdminShell";
import InfoHint from "@/components/InfoHint";
import AddTeamMemberModal, { type TeamKind, type TeamMember } from "../../add-team-member-modal";
import { KIND_LABEL, PersonDetailsDialog, PersonEditDialog, type Person } from "./person-dialogs";

function PersonCard({ p, busy, canEdit, canRemove, onOpen, onEdit, onRemove }: {
  p: Person; busy: boolean; canEdit: boolean; canRemove: boolean; onOpen: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const stop = (fn: () => void) => (e: React.SyntheticEvent) => { e.stopPropagation(); fn(); };
  return (
    <div
      role="button" tabIndex={0} aria-label={`View ${p.name}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-[1.75rem] bg-background p-2.5 pb-5 text-left transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-cream">
        {p.photoPath
          ? <Image src={`/api/uploads/${p.photoPath}`} alt={p.name} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" className="object-cover" />
          : <span className="flex h-full w-full items-center justify-center text-6xl font-medium text-primary/60">{p.name.slice(0, 1).toUpperCase()}</span>}
        {p.verified && <span title="Verified" className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-background text-primary"><BadgeCheck className="h-4 w-4" /></span>}
      </div>
      <div className="space-y-1 px-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-base font-medium">{p.name}</p>
          {(canEdit || canRemove) && (
            <div className="flex shrink-0 gap-1.5">
              {canEdit && <button type="button" onClick={stop(onEdit)} aria-label={`Edit ${p.name}`} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-full bg-cream hover:bg-cream/70"><Pencil className="h-4 w-4" /></button>}
              {canRemove && <button type="button" disabled={busy} onClick={stop(onRemove)} aria-label={`Remove ${p.name}`} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-destructive hover:bg-cream/70 disabled:opacity-60"><Trash2 className="h-4 w-4" /></button>}
            </div>
          )}
        </div>
        <p className="pt-1 font-medium">{KIND_LABEL[p.kind]}</p>
        {p.age ? <p className="text-muted-foreground">{p.age} years old</p> : null}
        <p className="truncate text-muted-foreground">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}

export default function ManagerAssigner({ propertyId, owners, managers, canAdd }: {
  propertyId: string; owners: Person[]; managers: Person[]; canAdd: boolean;
}) {
  const refresh = useSoftRefresh();
  const [adding, setAdding] = useState<TeamKind | null>(null);
  const [view, setView] = useState<Person | null>(null);
  const [edit, setEdit] = useState<Person | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function call(kind: TeamKind, method: "POST" | "DELETE", id: string) {
    setBusyId(id);
    setError("");
    const co = kind === "coOwner";
    const res = await authFetch(`/api/properties/${propertyId}/${co ? "co-owners" : "managers"}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(co ? { userId: id } : { managerId: id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId("");
    if (!res.ok) return setError(body.error ?? "Something went wrong.");
    refresh();
  }

  const remove = (p: Person) => {
    if (p.kind === "coOwner" && !window.confirm("Remove this co-owner? Their uploaded proof documents will be deleted.")) return;
    call(p.kind === "coOwner" ? "coOwner" : "manager", "DELETE", p.id);
  };

  const coCount = owners.filter((o) => o.kind === "coOwner").length;

  const group = (title: string, list: Person[], count: string, addKind: TeamKind, addLabel: string, full: boolean, hint?: string) => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title} <span className="font-normal text-muted-foreground">({count})</span>{hint && <InfoHint text={hint} className="ml-1.5" />}</h2>
        {canAdd && (
          <button type="button" disabled={full} onClick={() => setAdding(addKind)} className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-4 w-4" />{addLabel}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <Panel><p className="text-muted-foreground">No {title.toLowerCase()} yet.</p></Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <PersonCard
              key={`${p.kind}-${p.id}`} p={p} busy={busyId === p.id} canEdit={!!p.editable && p.kind !== "owner"} canRemove={canAdd && p.kind !== "owner"}
              onOpen={() => setView(p)} onEdit={() => setEdit(p)} onRemove={() => remove(p)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      {group("Owners", owners, `${owners.length}/${1 + MAX_CO_OWNERS}`, "coOwner", "Add co-owner", coCount >= MAX_CO_OWNERS, `Owner limit: 1 + ${MAX_CO_OWNERS} = ${1 + MAX_CO_OWNERS}. That is 1 main owner + up to ${MAX_CO_OWNERS} co-owners.`)}
      {group("Managers", managers, `${managers.length}/${MAX_MANAGERS}`, "manager", "Add manager", managers.length >= MAX_MANAGERS)}

      {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}

      {adding && (
        <AddTeamMemberModal
          open
          kind={adding}
          onClose={() => setAdding(null)}
          onCreated={async (m: TeamMember) => { await call(m.kind, "POST", m.id); }}
        />
      )}
      {view && (
        <PersonDetailsDialog
          person={view}
          onClose={() => setView(null)}
          onEdit={view.editable && view.kind !== "owner" ? () => { setEdit(view); setView(null); } : undefined}
        />
      )}
      {edit && <PersonEditDialog propertyId={propertyId} person={edit} onClose={() => setEdit(null)} onSaved={refresh} />}
    </div>
  );
}