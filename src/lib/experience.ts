// Appointed date + optional past experience -> one "experience" text. Used by the people forms and cards.
export function parseExperience(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const errors: Record<string, string> = {};
  let appointedAt: Date | null = null;
  if (s("appointedAt")) {
    const d = new Date(`${s("appointedAt")}T00:00:00.000Z`);
    if (isNaN(d.getTime()) || d.getTime() > Date.now()) errors.appointedAt = "Enter a valid date, not in the future.";
    else appointedAt = d;
  }
  let pastMonths: number | null = null;
  if (s("hasPastExp") === "yes") {
    const y = Number(s("expYears") || 0), m = Number(s("expMonths") || 0);
    if (!Number.isInteger(y) || !Number.isInteger(m) || y < 0 || y > 60 || m < 0 || m > 11 || y * 12 + m === 0) errors.pastExp = "Enter past experience in years and months (months 0 to 11).";
    else pastMonths = y * 12 + m;
  }
  return { appointedAt, pastMonths, errors };
}

export function experienceText(appointedAt: Date | null, pastMonths: number | null): string | null {
  if (!appointedAt && !pastMonths) return null;
  let total = pastMonths ?? 0;
  if (appointedAt) {
    const n = new Date();
    total += Math.max(0, (n.getFullYear() - appointedAt.getUTCFullYear()) * 12 + n.getMonth() - appointedAt.getUTCMonth() - (n.getDate() < appointedAt.getUTCDate() ? 1 : 0));
  }
  const y = Math.floor(total / 12), m = total % 12;
  if (total === 0) return "Less than a month experience";
  return `${[y ? `${y} ${y === 1 ? "year" : "years"}` : "", m ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean).join(" ")} experience`;
}
