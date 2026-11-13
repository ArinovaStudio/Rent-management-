import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, Tabs, toneFor } from "../ui";

const FILTERS = [
  { key: "pending", label: "Awaiting approval", status: "PENDING" },
  { key: "info", label: "Needs more information", status: "NEEDS_MORE_INFO" },
  { key: "approved", label: "Approved", status: "APPROVED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
] as const;
const LABEL = { PENDING: "Awaiting approval", NEEDS_MORE_INFO: "More information needed", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const TYPE = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;

export default async function PropertyApprovals({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const me = await requireSuperAdmin();
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const properties = await prisma.property.findMany({
    where: { status: active.status },
    include: { owner: { select: { name: true } }, authorityProof: { select: { id: true } } },
    orderBy: { updatedAt: "asc" },
  });
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="Property approvals" sub="Review new and updated listings before they go live." />
      <Tabs base="/admin/approvals" active={active.key} items={FILTERS.map((f) => ({ key: f.key, label: f.label }))} />
      <Panel className="mt-6 overflow-x-auto">
        {properties.length === 0 ? (
          <p className="text-muted-foreground">Nothing here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                {["Property", "Type", "City", "Owner", "Authority proof", "Status", ""].map((h) => <th key={h} className="py-3 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-t border-cream">
                  <td className="py-3 pr-4 font-medium">{p.name}</td>
                  <td className="py-3 pr-4">{TYPE[p.type]}</td>
                  <td className="py-3 pr-4">{p.city}</td>
                  <td className="py-3 pr-4">{p.owner.name}</td>
                  <td className="py-3 pr-4">{p.authorityProof ? "Provided" : "None"}</td>
                  <td className="py-3 pr-4"><Chip tone={toneFor(p.status)}>{LABEL[p.status]}</Chip></td>
                  <td className="py-3"><Link href={`/admin/approvals/${p.id}`} className="rounded-full bg-primary px-4 py-2 text-primary-foreground hover:bg-ink">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}