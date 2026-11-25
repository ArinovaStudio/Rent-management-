import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip } from "@/app/admin/ui";
import ProfileForms from "./profile-forms";

const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", PROPERTY_ADMIN: "Property Admin", PROPERTY_MANAGER: "Property Manager" } as const;

// Profile for every staff role (Super Admin, Property Admin, Property Manager).
//  - Account created by someone else: they were given a temporary password, so the page asks them to change it.
//  - Account the person signed up for: they can verify their email and change the password with an emailed code.
export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const creator = me.createdById ? await prisma.user.findUnique({ where: { id: me.createdById }, select: { name: true } }) : null;
  const createdByAdmin = !!me.createdById;

  return (
    <AdminShell role={me.role} name={me.name}>
      <PageHeader title="Profile" sub="Your account details and password." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-xl font-semibold">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{me.name}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Role</dt><dd className="font-medium">{ROLE_LABEL[me.role]}</dd></div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {me.email}
                {me.role !== "SUPER_ADMIN" && <Chip tone={me.emailVerifiedAt ? "good" : "neutral"}>{me.emailVerifiedAt ? "Verified" : "Not verified"}</Chip>}
              </dd>
            </div>
            {createdByAdmin && creator && (
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Account created by</dt><dd className="font-medium">{creator.name}</dd></div>
            )}
          </dl>
        </Panel>

        <ProfileForms isSuperAdmin={me.role === "SUPER_ADMIN"} createdByAdmin={createdByAdmin} emailVerified={!!me.emailVerifiedAt} hasPassword={!!me.passwordHash} email={me.email} />
      </div>
    </AdminShell>
  );
}