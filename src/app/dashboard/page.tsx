import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";
import { SMS_VERIFICATION_ENABLED, STATUS_HELP, STATUS_LABEL } from "@/lib/owner-status";
import VerificationActions from "./verification-actions";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  PROPERTY_ADMIN: "Property Admin",
  PROPERTY_MANAGER: "Property Manager",
} as const;

export default async function Dashboard() {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  const user = session && (await prisma.user.findUnique({ where: { id: session.userId }, include: { ownerProfile: true } }));
  if (!user) redirect("/login");
  const profile = user.ownerProfile;

  return (
    <main>
      <h1>Dashboard</h1>
      <p>{user.name} ({user.email})</p>
      <p>Role: {ROLE_LABEL[user.role]}</p>
      {profile && (
        <section className="notice" aria-label="Verification status">
          <p style={{ margin: 0 }}>
            <strong>{STATUS_LABEL[profile.verificationStatus]}</strong>
          </p>
          <p style={{ margin: "4px 0 0" }}>{STATUS_HELP[profile.verificationStatus]}</p>
          {profile.verificationStatus === "CONTACT_PENDING" && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>Email: {user.emailVerifiedAt ? "verified" : "not verified yet"}</li>
              {SMS_VERIFICATION_ENABLED && <li>Mobile: {profile.phoneVerifiedAt ? "verified" : "not verified yet"}</li>}
            </ul>
          )}
          {profile.reviewNote && ["NEEDS_MORE_INFO", "REJECTED", "RESTRICTED"].includes(profile.verificationStatus) && (
            // <p style={{ margin: "8px 0 0" }}>Note from the reviewer: {profile.reviewNote}</p>
            <p style={{ margin: "8px 0 0" }}>
              Note from the reviewer ({profile.statusUpdatedAt.toLocaleDateString("en-IN")}): {profile.reviewNote}
            </p>
          )}
          <VerificationActions
            needsEmail={profile.verificationStatus === "CONTACT_PENDING" && !user.emailVerifiedAt}
            needsDocument={profile.verificationStatus === "NEEDS_MORE_INFO"}
          />
        </section>
      )}
      {user.role === "SUPER_ADMIN" && (
        <>
          <p><a href="/dashboard/admin/kyc">KYC review</a></p>
          <p><a href="/dashboard/admin/properties">Property approvals</a></p>
        </>
      )}
      {user.role !== "PROPERTY_MANAGER" && (
        <p><a href="/dashboard/users">Manage users</a></p>
      )}
      <p><a href="/dashboard/properties">Properties</a></p>
      <p><a href="/dashboard/issues">Issues</a></p>
      {user.role === "PROPERTY_ADMIN" && profile && profile.verificationStatus !== "VERIFIED" && (
        <p className="muted">You can add properties once your account is verified.</p>
      )}
      <form action="/api/auth/logout" method="post">
        <button>Sign out</button>
      </form>
    </main>
  );
}
