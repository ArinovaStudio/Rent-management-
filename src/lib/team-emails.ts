import { prisma } from "@/lib/db";
import { notify } from "@/lib/mailer";

const TYPE_LABEL: Record<string, string> = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" };

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? null;
}

async function loadProperty(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: { select: { name: true, email: true } },
      rooms: { select: { floor: true, isActive: true } },
    },
  });
}

function propertyLines(p: NonNullable<Awaited<ReturnType<typeof loadProperty>>>) {
  const floors = new Set(p.rooms.map((r) => r.floor ?? 0)).size;
  const unit = p.type === "BUILDING" ? "flats" : p.type === "PG" ? "rooms" : "units";
  return [
    "Property details",
    `Name: ${p.name}`,
    `Type: ${TYPE_LABEL[p.type] ?? p.type}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`,
    `Address: ${p.address}, ${p.city}`,
    ...(p.mapUrl ? [`Map: ${p.mapUrl}`] : []),
    `Size: ${p.rooms.length} ${unit}${floors > 1 ? ` across ${floors} floors` : ""}`,
    `Owner: ${p.owner.name} (${p.owner.email})`,
    ...(p.isActive
      ? []
      : [`Status: currently inactive${p.inactiveNote ? ` (${p.inactiveNote})` : ""}. New residents can't be added until it is switched On.`]),
  ];
}

function loginLines() {
  const app = appUrl();
  return [
    "Signing in",
    "Use the login email and temporary password that were sent when your account was created.",
    "After you sign in, open Profile and change the temporary password to one only you know.",
    ...(app ? [`Sign in: ${app}/login`] : ["Sign in from the app login page."]),
  ];
}

// Tells a newly linked co-owner about the property and how to get started. Best effort: never fails the assignment.
export async function emailCoOwnerAssignment(
  propertyId: string,
  coOwner: { name?: string | null; email: string },
  assignedBy: string,
) {
  const p = await loadProperty(propertyId);
  if (!p) return;

  const app = appUrl();
  const hi = coOwner.name ? `Hi ${coOwner.name},` : "Hi,";
  const lines = [
    hi,
    "",
    `${assignedBy} added you as a co-owner of this property. You can see it under Properties when you sign in.`,
    "",
    ...propertyLines(p),
    "",
    ...loginLines(),
    "",
    "What you can do",
    "- View and help manage the property listing",
    "- Work with managers and residents on this property",
    "- Raise issues and follow payments from the dashboard",
    "",
    app ? `Open the property: ${app}/dashboard/properties/${p.id}` : "Sign in and open Properties to get started.",
    "",
    "If you were not expecting this, contact the person who added you.",
  ];
  await notify(coOwner.email, `You were added as co-owner of "${p.name}"`, lines.join("\n"));
}

// Tells the manager which property they now run, with the details they need to get started. Best effort: never fails the assignment.
export async function emailManagerAssignment(
  propertyId: string,
  manager: { name: string; email: string },
  assignedBy: string,
) {
  const p = await loadProperty(propertyId);
  if (!p) return;

  const app = appUrl();
  const lines = [
    `Hi ${manager.name},`,
    "",
    `${assignedBy} has assigned you to manage a property. You can now see it under Properties when you sign in.`,
    "",
    ...propertyLines(p),
    "",
    ...loginLines(),
    "",
    "What you can do",
    "- Allocate residents and check them out, and see who lives where",
    "- Generate electricity and water bills and send them to residents",
    "- Mark rent and bills as paid in the Payment Ledger and send payment reminders",
    "- Switch rooms or floors On or Off in Availability",
    "- Raise an issue with the owner from Properties or Issues",
    "You cannot edit the property listing itself. Ask the owner or the Super Admin for that.",
    "",
    app ? `Open the property: ${app}/dashboard/properties/${p.id}/rooms` : "Sign in and open Properties to get started.",
    "",
    "If you were not expecting this, contact the person who assigned you.",
  ];
  await notify(manager.email, `You have been assigned to ${p.name}`, lines.join("\n"));
}

type Member = { id: string; name: string; email: string; role?: string };

// Login details for an account an admin just created (holds the temporary password).
export async function emailAccountCreated(
  to: { name: string; email: string; role: string },
  password: string,
  createdBy: string,
) {
  const loginUrl = appUrl() ? `${appUrl()}/login` : null;
  const roleLabel = to.role === "PROPERTY_MANAGER" ? "Property Manager" : "Property Admin (co-owner)";
  await notify(
    to.email,
    "Your account has been created",
    `Hi ${to.name},\n\n${createdBy} created a ${roleLabel} account for you.\n\n` +
      `Your login details:\nLogin ID (email): ${to.email}\nTemporary password: ${password}\n\n` +
      (loginUrl ? `Sign in here: ${loginUrl}\n\n` : "") +
      `You do not need to verify your account. After you sign in, open Profile and change this temporary password to one only you know. Do not share it with anyone.`,
  );
}

// Called once, after the property is saved. Sends the held login mail (people created in the property form)
// and the "you were added" mail. Best effort: a mail problem never fails the save.
export async function sendTeamEmailsAfterSave(
  propertyId: string,
  a: { coOwners: Member[]; managers: Member[]; logins: Record<string, string>; by: string },
) {
  const welcome = (m: Member) => {
    const pw = a.logins[m.id];
    return pw && m.role ? emailAccountCreated({ name: m.name, email: m.email, role: m.role }, pw, a.by) : Promise.resolve();
  };
  await Promise.allSettled([
    ...a.coOwners.map((m) => welcome(m).then(() => emailCoOwnerAssignment(propertyId, m, a.by))),
    ...a.managers.map((m) => welcome(m).then(() => emailManagerAssignment(propertyId, m, a.by))),
  ]);
}

// Reads the { userId: temporaryPassword } map the property form sends for people created in this session.
// Only accounts the caller created in the last day are honoured, so it can't be used to mail arbitrary text.
export function parseLogins(raw: FormDataEntryValue | null): Record<string, string> {
  if (typeof raw !== "string" || !raw || raw.length > 4000) return {};
  try {
    const o = JSON.parse(raw);
    const out: Record<string, string> = {};
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (typeof v === "string" && v.length <= 200) out[k] = v;
    return out;
  } catch { return {}; }
}
