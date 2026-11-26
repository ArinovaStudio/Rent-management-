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
