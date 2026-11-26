"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { MAX_CO_OWNERS, MAX_MANAGERS } from "@/lib/team-limits";
import { PLATFORM_LISTER, type ListedBy } from "@/lib/property-fields";
import { F } from "./property-sections";
import AddTeamMemberModal, { type TeamKind, type TeamMember } from "./add-team-member-modal";

type Props = {
  role: string;
  editing: boolean;
  propertyId?: string;
  listedBy?: ListedBy | null;
  owners?: { id: string; name: string }[];
  ownerId: string;
  onOwnerIdChange: (id: string) => void;
  // Staged people for a new property (created accounts waiting to be linked on save).
  pending: TeamMember[];
  onPendingChange: (list: TeamMember[]) => void;
  // Already linked on an existing property.
  coOwners?: { userId: string; name: string; email: string; documents: number }[];
  managers?: { id: string; name: string; email: string }[];
};

export default function OwnerTeamSection({
  role, editing, propertyId, listedBy, owners, ownerId, onOwnerIdChange,
  pending, onPendingChange, coOwners = [], managers = [],
}: Props) {
  const refresh = useSoftRefresh();
  const [modal, setModal] = useState<TeamKind | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const isSuper = role === "SUPER_ADMIN";
  const canCreateCoOwner = isSuper || role === "PROPERTY_ADMIN";
  const canCreateManager = isSuper || role === "PROPERTY_ADMIN";

  const pendingCo = pending.filter((p) => p.kind === "coOwner");
  const pendingMgr = pending.filter((p) => p.kind === "manager");
  const coCount = editing ? coOwners.length : pendingCo.length;
  const mgrCount = editing ? managers.length : pendingMgr.length;
  const coFull = coCount >= MAX_CO_OWNERS;
  const mgrFull = mgrCount >= MAX_MANAGERS;

  async function assignCreated(m: TeamMember) {
    setError("");
    if (!editing || !propertyId) {
      onPendingChange([...pending.filter((p) => p.id !== m.id), m]);
      return;
    }
    if (m.kind === "coOwner") {
      const res = await authFetch(`/api/properties/${propertyId}/co-owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not add co-owner.");
        return;
      }
    } else {
      const res = await authFetch(`/api/properties/${propertyId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: m.id }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not assign manager.");
        return;
      }
    }
    refresh();
  }

  async function removeCo(userId: string) {
    if (!propertyId) return;
    if (!window.confirm("Remove this co-owner? Their uploaded proof documents will be deleted.")) return;
    setBusyId(userId);
    const res = await authFetch(`/api/properties/${propertyId}/co-owners`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusyId("");
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not remove co-owner.");
    else refresh();
  }

  async function removeMgr(id: string) {
    if (!propertyId) return;
    setBusyId(id);
    const res = await authFetch(`/api/properties/${propertyId}/managers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: id }),
    });
    setBusyId("");
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not remove manager.");
    else refresh();
  }

  const ownerName = owners?.find((o) => o.id === ownerId)?.name;

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
            <p className="font-medium">Co-owners <span className="font-normal text-muted-foreground">({coCount}/{MAX_CO_OWNERS})</span></p>
            {canCreateCoOwner && (
              <button
                type="button"
                disabled={coFull}
                onClick={() => setModal("coOwner")}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />Add co-owner
              </button>
            )}
          </div>
          {coCount === 0 ? (
            <p className="text-sm text-muted-foreground">No co-owners yet.</p>
          ) : editing ? (
            <ul className="space-y-2">
              {coOwners.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email} · {c.documents} proof document{c.documents === 1 ? "" : "s"}</p>
                  </div>
                  <button type="button" disabled={busyId === c.userId} onClick={() => removeCo(c.userId)} className="shrink-0 text-sm text-destructive disabled:opacity-50">Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {pendingCo.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email} · will be linked when you save</p>
                  </div>
                  <button type="button" onClick={() => onPendingChange(pending.filter((p) => p.id !== c.id))} className="shrink-0 text-sm text-destructive">Remove</button>
                </li>
              ))}
            </ul>
          )}
          {pendingCo.map((c) => <input key={c.id} type="hidden" name="coOwnerIds" value={c.id} />)}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Managers <span className="font-normal text-muted-foreground">({mgrCount}/{MAX_MANAGERS})</span></p>
            {canCreateManager && (
              <button
                type="button"
                disabled={mgrFull}
                onClick={() => setModal("manager")}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />Add manager
              </button>
            )}
          </div>
          {mgrCount === 0 ? (
            <p className="text-sm text-muted-foreground">No managers yet.</p>
          ) : editing ? (
            <ul className="space-y-2">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <button type="button" disabled={busyId === m.id} onClick={() => removeMgr(m.id)} className="shrink-0 text-sm text-destructive disabled:opacity-50">Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {pendingMgr.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email} · will be linked when you save</p>
                  </div>
                  <button type="button" onClick={() => onPendingChange(pending.filter((p) => p.id !== m.id))} className="shrink-0 text-sm text-destructive">Remove</button>
                </li>
              ))}
            </ul>
          )}
          {pendingMgr.map((m) => <input key={m.id} type="hidden" name="managerIds" value={m.id} />)}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {coFull && <p className="text-xs text-muted-foreground">Maximum of {MAX_CO_OWNERS} co-owners per property.</p>}
        {mgrFull && <p className="text-xs text-muted-foreground">Maximum of {MAX_MANAGERS} managers per property.</p>}
      </div>

      {modal && (
        <AddTeamMemberModal
          open
          kind={modal}
          onKindChange={setModal}
          onClose={() => setModal(null)}
          onCreated={assignCreated}
          canCreateCoOwner={canCreateCoOwner && !coFull}
          canCreateManager={canCreateManager && !mgrFull}
        />
      )}
    </>
  );
}
