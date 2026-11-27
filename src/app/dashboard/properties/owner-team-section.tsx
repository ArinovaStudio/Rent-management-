"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Pencil, Plus } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { MAX_CO_OWNERS, MAX_MANAGERS } from "@/lib/team-limits";
import { PLATFORM_LISTER, type ListedBy } from "@/lib/property-fields";
import InfoHint from "@/components/InfoHint";
import { F } from "./property-sections";
import type { TeamKind, TeamMember } from "./add-team-member-modal";
import type { Person } from "./[id]/managers/person-dialogs";

// Popups load only when opened, so the property form itself stays light.
const AddTeamMemberModal = dynamic(() => import("./add-team-member-modal"), { ssr: false });
const PersonEditDialog = dynamic(() => import("./[id]/managers/person-dialogs").then((m) => m.PersonEditDialog), { ssr: false });
const PersonDetailsDialog = dynamic(() => import("./[id]/managers/person-dialogs").then((m) => m.PersonDetailsDialog), { ssr: false });

type Props = {
  role: string;
  editing: boolean;
  propertyId?: string;
  listedBy?: ListedBy | null;
  owners?: { id: string; name: string }[];
  ownerId: string;
  onOwnerIdChange: (id: string) => void;
  // People created in this form session. They are linked and emailed only when the property is saved.
  pending: TeamMember[];
  onPendingChange: (list: TeamMember[]) => void;
  // Already linked on an existing property.
  coOwners?: { userId: string; name: string; email: string; documents: number }[];
  managers?: { id: string; name: string; email: string }[];
};

type Row = { id: string; name: string; email: string; sub: string; saved: boolean };

export default function OwnerTeamSection({
  role, editing, propertyId, listedBy, owners, ownerId, onOwnerIdChange,
  pending, onPendingChange, coOwners = [], managers = [],
}: Props) {
  const refresh = useSoftRefresh();
  const [modal, setModal] = useState<TeamKind | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [editPerson, setEditPerson] = useState<{ person: Person; saved: boolean } | null>(null);

  const isSuper = role === "SUPER_ADMIN";
  const canCreateCoOwner = isSuper || role === "PROPERTY_ADMIN";
  const canCreateManager = isSuper || role === "PROPERTY_ADMIN";

  const pendingCo = pending.filter((p) => p.kind === "coOwner");
  const pendingMgr = pending.filter((p) => p.kind === "manager");
  const savedCo = editing ? coOwners : [];
  const savedMgr = editing ? managers : [];
  const coCount = savedCo.length + pendingCo.length;
  const mgrCount = savedMgr.length + pendingMgr.length;
  const coFull = coCount >= MAX_CO_OWNERS;
  const mgrFull = mgrCount >= MAX_MANAGERS;

  const coRows: Row[] = [
    ...savedCo.map((c) => ({ id: c.userId, name: c.name, email: c.email, sub: `${c.email} · ${c.documents} proof document${c.documents === 1 ? "" : "s"}`, saved: true })),
    ...pendingCo.map((c) => ({ id: c.id, name: c.name, email: c.email, sub: `${c.email} · added when you save`, saved: false })),
  ];
  const mgrRows: Row[] = [
    ...savedMgr.map((m) => ({ id: m.id, name: m.name, email: m.email, sub: m.email, saved: true })),
    ...pendingMgr.map((m) => ({ id: m.id, name: m.name, email: m.email, sub: `${m.email} · added when you save`, saved: false })),
  ];

  // Nothing is linked or emailed here. The person waits in the list until the property is saved.
  function stage(m: TeamMember) {
    setError("");
    onPendingChange([...pending.filter((p) => p.id !== m.id), m]);
  }

  async function openEdit(r: Row) {
    setError("");
    setLoadingId(r.id);
    const q = r.saved && propertyId ? `?propertyId=${propertyId}` : "";
    const res = await authFetch(`/api/team-members/${r.id}${q}`);
    setLoadingId("");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not load this person.");
    setEditPerson({ person: body as Person, saved: r.saved });
  }

  function onEdited(name?: string) {
    const target = editPerson;
    if (!target) return;
    if (target.saved) refresh();
    else if (name) onPendingChange(pending.map((p) => (p.id === target.person.id ? { ...p, name } : p)));
  }

  async function removeSaved(kind: TeamKind, id: string) {
    if (!propertyId) return;
    if (kind === "coOwner" && !window.confirm("Remove this co-owner? Their uploaded proof documents will be deleted.")) return;
    setBusyId(id);
    const co = kind === "coOwner";
    const res = await authFetch(`/api/properties/${propertyId}/${co ? "co-owners" : "managers"}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(co ? { userId: id } : { managerId: id }),
    });
    setBusyId("");
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? `Could not remove ${co ? "co-owner" : "manager"}.`);
    else refresh();
  }

  const removeRow = (kind: TeamKind, r: Row) => (r.saved ? removeSaved(kind, r.id) : onPendingChange(pending.filter((p) => p.id !== r.id)));

  const ownerName = owners?.find((o) => o.id === ownerId)?.name;

  const list = (kind: TeamKind, rows: Row[]) => (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" disabled={loadingId === r.id} onClick={() => openEdit(r)} className="flex items-center gap-1 text-sm hover:text-primary disabled:opacity-50"><Pencil className="h-3.5 w-3.5" />View / edit</button>
            <button type="button" disabled={busyId === r.id} onClick={() => removeRow(kind, r)} className="text-sm text-destructive disabled:opacity-50">Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );

  const addBtn = (kind: TeamKind, full: boolean, label: string) => (
    <button
      type="button"
      disabled={full}
      onClick={() => setModal(kind)}
      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Plus className="h-4 w-4" />{label}
    </button>
  );

  // Login details for people created in this form. Sent to the server only so the mail can go out after the save.
  const logins = Object.fromEntries(pending.filter((p) => p.password).map((p) => [p.id, p.password]));

  return (
    <>
      {owners && !editing ? (
        <>
          <div className="grid gap-1 rounded-2xl bg-cream p-5 sm:col-span-2">
            <p className="font-medium">Listed by {PLATFORM_LISTER}</p>
            {ownerName
              ? <p className="text-sm">Owned by <strong>{ownerName}</strong></p>
              : <p className="text-sm text-muted-foreground">Listed directly by the platform. Assign an owner below if this property belongs to a Property Admin.</p>}
          </div>
          <F label="Primary owner (optional)" wide>
            <select className="field" name="ownerId" value={ownerId} onChange={(e) => onOwnerIdChange(e.target.value)}>
              <option value="">No owner (platform-owned)</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
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

      <div className="space-y-4 sm:col-span-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Co-owners <span className="font-normal text-muted-foreground">({coCount}/{MAX_CO_OWNERS})</span><InfoHint className="ml-1.5" text={`Owner limit: 1 + ${MAX_CO_OWNERS} = ${1 + MAX_CO_OWNERS}. That is 1 main owner + up to ${MAX_CO_OWNERS} co-owners. The main owner is not counted in this number.`} /></p>
            {canCreateCoOwner && addBtn("coOwner", coFull, "Add co-owner")}
          </div>
          {coRows.length === 0 ? <p className="text-sm text-muted-foreground">No co-owners yet.</p> : list("coOwner", coRows)}
          {pendingCo.map((c) => <input key={c.id} type="hidden" name="coOwnerIds" value={c.id} />)}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Managers <span className="font-normal text-muted-foreground">({mgrCount}/{MAX_MANAGERS})</span></p>
            {canCreateManager && addBtn("manager", mgrFull, "Add manager")}
          </div>
          {mgrRows.length === 0 ? <p className="text-sm text-muted-foreground">No managers yet.</p> : list("manager", mgrRows)}
          {pendingMgr.map((m) => <input key={m.id} type="hidden" name="managerIds" value={m.id} />)}
        </div>

        {pending.length > 0 && <input type="hidden" name="teamLogin" value={JSON.stringify(logins)} />}
        {pending.length > 0 && <p className="text-xs text-muted-foreground">New people are emailed their login and property details only after you save the property.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {coFull && <p className="text-xs text-muted-foreground">Maximum of {MAX_CO_OWNERS} co-owners per property.</p>}
        {mgrFull && <p className="text-xs text-muted-foreground">Maximum of {MAX_MANAGERS} managers per property.</p>}
      </div>

      {modal && (
        <AddTeamMemberModal
          open
          defer
          kind={modal}
          onClose={() => setModal(null)}
          onCreated={stage}
        />
      )}
      {editPerson && !editPerson.person.editable && (
        <PersonDetailsDialog person={editPerson.person} onClose={() => setEditPerson(null)} />
      )}
      {editPerson && editPerson.person.editable && (
        <PersonEditDialog
          endpoint={`/api/team-members/${editPerson.person.id}${editPerson.saved && propertyId ? `?propertyId=${propertyId}` : ""}`}
          person={editPerson.person}
          onClose={() => setEditPerson(null)}
          onSaved={onEdited}
        />
      )}
    </>
  );
}
