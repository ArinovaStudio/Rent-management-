import type { IssueCategory, IssuePriority, IssueStatus, Role } from "@prisma/client";

// Labels and tones for tickets. No server imports here, so client components can use it.
export const CATEGORY_LABEL: Record<IssueCategory, string> = {
  MAINTENANCE: "Maintenance", PLUMBING: "Plumbing", ELECTRICAL: "Electrical", CLEANING: "Cleaning", SECURITY: "Security",
  RESIDENT_COMPLAINT: "Resident complaint", BILLING: "Payment or billing", SAFETY: "Safety", OTHER: "Other",
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as IssueCategory[];

export const PRIORITIES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const PRIORITY_LABEL: Record<IssuePriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
export const STATUS_LABEL: Record<IssueStatus, string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" };
export const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: "Super Admin", PROPERTY_ADMIN: "Property Admin", PROPERTY_MANAGER: "Manager" };

// What people see as the ticket number. Old tickets (made before ticket codes) still show #<number>.
export const ticketLabel = (i: { ticketNo: number; ticketCode?: string | null }) => i.ticketCode ?? `#${i.ticketNo}`;

export const priorityTone = (p: string) => (p === "HIGH" || p === "URGENT" ? ("bad" as const) : ("neutral" as const));
export const statusTone = (s: string) => (s === "RESOLVED" || s === "CLOSED" ? ("good" as const) : ("neutral" as const));
export const withWho = (i: { escalatedAt: Date | null; recipientId?: string | null }) =>
  i.escalatedAt ? "Super Admin" : i.recipientId ? "Co-owner" : "Property Admin";

