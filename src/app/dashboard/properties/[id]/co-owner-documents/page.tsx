import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell, Panel } from "@/components/admin/AdminShell";
import { propertiesBase } from "@/lib/routes";
import CoOwnerDocumentForm from "./co-owner-document-form";

export default async function CoOwnerDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const { id } = await params;
  const assignment = await prisma.propertyCoOwner.findUnique({
    where: { propertyId_userId: { propertyId: id, userId: me.id } },
    include: { property: { select: { id: true, name: true } }, documents: { orderBy: { uploadedAt: "desc" }, select: { id: true, name: true, originalName: true, uploadedAt: true } } },
  });
  if (!assignment) notFound();
  const name = (me as unknown as { name?: string }).name ?? "Account";
  return (
    <AdminShell role={me.role} name={name}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div><Link href={propertiesBase(me.role)} className="text-sm text-primary underline">← Back to properties</Link><h1 className="mt-3 text-3xl font-semibold">Co-owner proof documents</h1><p className="mt-1 text-muted-foreground">{assignment.property.name}</p></div>
        <Panel><p className="mb-4 text-sm text-muted-foreground">Upload documents that establish your co-ownership or authority for this property. These files are private and are kept separate from the primary owner&apos;s proof.</p><CoOwnerDocumentForm propertyId={id} documents={assignment.documents} /></Panel>
      </div>
    </AdminShell>
  );
}
