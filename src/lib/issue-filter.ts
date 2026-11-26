import type { IssueCategory, IssuePriority, IssueStatus } from "@prisma/client";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "./issue-constants";
import { splitFilter } from "./property-filter";

export type IssueFilterParams = {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
};

// No status in the URL = open tickets (same as the old default tab).
export const DEFAULT_ISSUE_STATUS = "OPEN,IN_PROGRESS";

export const ISSUE_STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as IssueStatus[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

export const ISSUE_PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as IssuePriority[]).map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
}));

export const ISSUE_CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as IssueCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));

export function hasIssueFilters(f: IssueFilterParams) {
  return !!(f.q?.trim() || (f.status && f.status !== DEFAULT_ISSUE_STATUS) || f.priority || f.category);
}

export function applyIssueFilters<
  T extends {
    title: string;
    ticketCode?: string | null;
    ticketNo: number;
    status: string;
    priority: string;
    category: string;
    property: { name: string };
  },
>(list: T[], f: IssueFilterParams): T[] {
  const q = f.q?.trim().toLowerCase();
  const rawStatus = f.status === "all" ? "" : (f.status ?? DEFAULT_ISSUE_STATUS);
  const statuses = splitFilter(rawStatus);
  const priorities = splitFilter(f.priority);
  const categories = splitFilter(f.category);

  return list.filter((i) => {
    if (q) {
      const hay = `${i.title} ${i.ticketCode ?? ""} ${i.ticketNo} ${i.property.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statuses.length && !statuses.includes(i.status)) return false;
    if (priorities.length && !priorities.includes(i.priority)) return false;
    if (categories.length && !categories.includes(i.category)) return false;
    return true;
  });
}
