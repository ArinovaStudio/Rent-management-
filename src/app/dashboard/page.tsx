import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, BedDouble, Building2, Clock, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus, SMS_VERIFICATION_ENABLED, STATUS_HELP, STATUS_LABEL } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { issueScope } from "@/lib/issues";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";
import VerificationActions from "./verification-actions";

const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", PROPERTY_ADMIN: "Property Admin", PROPERTY_MANAGER: "Property Manager" } as const;
const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const PROPERTY_STATUS = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

export default async function Dashboard() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isManager = me.role === "PROPERTY_MANAGER";
  const name = (me as unknown as { name?: string }).name ?? "Account";

  // Same visibility rules as the Properties and Issues pages
  const propWhere =
    me.role === "SUPER_ADMIN" ? {}
    : isManager ? { managers: { some: { managerId: me.id } } }
    : { OR: [{ ownerId: me.id }, { coOwners: { some: { userId: me.id } } }] };
  const issueWhere = issueScope(me);
  const openWhere = { ...issueWhere, status: { in: ["OPEN", "IN_PROGRESS"] as ("OPEN" | "IN_PROGRESS")[] } };

  const [user, properties, allocations, openCount, openIssues, verification] = await Promise.all([
    prisma.user.findUnique({ where: { id: me.id }, include: { ownerProfile: true } }),
    prisma.property.findMany({
      where: propWhere,
      select: { id: true, name: true, type: true, city: true, status: true, ownerId: true, coOwners: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.allocation.count({ where: { status: "ACTIVE", room: { property: propWhere } } }),
    prisma.issue.count({ where: openWhere }),
    prisma.issue.findMany({
      where: openWhere,
      include: { property: { select: { name: true } }, room: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    getVerificationStatus(me.id),
  ]);
  const profile = user?.ownerProfile;
  const base = propertiesBase(me.role);
  const canAdd = !isManager && canManageProperties(me.role, verification);
  const live = properties.filter((p) => p.status === "APPROVED").length;
  const waiting = properties.filter((p) => p.status === "PENDING" || p.status === "NEEDS_MORE_INFO").length;

  const stats = [
    { label: "Properties", value: properties.length, icon: Building2 },
    { label: "Live listings", value: live, icon: Building2 },
    { label: "Waiting for review", value: waiting, icon: Clock },
    { label: "Active allocations", value: allocations, icon: BedDouble },
    { label: "Open issues", value: openCount, icon: AlertCircle },
  ];

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader
        title={`Welcome, ${name.split(" ")[0]}`}
        sub={ROLE_LABEL[me.role]}
        action={canAdd && (
          <Link href={`${base}/new`} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink">
            <Plus className="h-4 w-4" />Add property
          </Link>
        )}
      />

      <div className="space-y-6">
        {profile && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Account verification</h2>
              <Chip tone={toneFor(profile.verificationStatus)}>{STATUS_LABEL[profile.verificationStatus]}</Chip>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{STATUS_HELP[profile.verificationStatus]}</p>
            {profile.verificationStatus === "CONTACT_PENDING" && (
              <ul className="mt-3 space-y-1 text-sm">
                <li>Email: {user?.emailVerifiedAt ? "verified" : "not verified yet"}</li>
                {SMS_VERIFICATION_ENABLED && <li>Mobile: {profile.phoneVerifiedAt ? "verified" : "not verified yet"}</li>}
              </ul>
            )}
            {profile.reviewNote && ["NEEDS_MORE_INFO", "REJECTED", "RESTRICTED"].includes(profile.verificationStatus) && (
              <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm">
                Note from the reviewer ({profile.statusUpdatedAt.toLocaleDateString("en-IN")}): {profile.reviewNote}
              </p>
            )}
            <VerificationActions
              needsEmail={profile.verificationStatus === "CONTACT_PENDING" && !user?.emailVerifiedAt}
              needsDocument={profile.verificationStatus === "NEEDS_MORE_INFO"}
            />
            {me.role === "PROPERTY_ADMIN" && profile.verificationStatus !== "VERIFIED" && (
              <p className="mt-3 text-sm text-muted-foreground">You can add properties once your account is verified.</p>
            )}
          </Panel>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((s) => (
            <Panel key={s.label} className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></span>
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
            </Panel>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Your properties</h2>
              <Link href={base} className="text-sm text-primary underline">View all</Link>
            </div>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet.</p>
            ) : (
              <ul className="space-y-2">
                {properties.slice(0, 5).map((p) => {
                  const coOwner = p.ownerId !== me.id && p.coOwners.some((c) => c.userId === me.id);
                  return (
                    <li key={p.id}>
                      <Link href={`${base}/${p.id}/${coOwner ? "co-owner-documents" : "rooms"}`} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm hover:bg-cream">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{TYPE_LABEL[p.type]} · {p.city}</span>
                        </span>
                        <Chip tone={toneFor(p.status)}>{PROPERTY_STATUS[p.status]}</Chip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Open issues</h2>
              <Link href="/dashboard/issues" className="text-sm text-primary underline">View all</Link>
            </div>
            {openIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open issues.</p>
            ) : (
              <ul className="space-y-2">
                {openIssues.map((i) => (
                  <li key={i.id}><Link href={`/dashboard/issues/${i.id}`} className="block rounded-2xl bg-cream/60 px-4 py-3 text-sm hover:bg-cream">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{i.title}</span>
                      <Chip tone={i.priority === "HIGH" || i.priority === "URGENT" ? "bad" : "neutral"}>{i.priority.toLowerCase()}</Chip>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{i.property.name}{i.room ? ` · ${i.room.label}` : ""} · {i.createdAt.toLocaleDateString("en-IN")}</p>
                  </Link></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
