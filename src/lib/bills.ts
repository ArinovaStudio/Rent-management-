export const BILL_LABEL = { ELECTRICITY: "Electricity", WATER: "Water" } as const;

// Bills are due on this day of the month after the billing month
export const DUE_DAY = 10;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const fmtDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// period "2026-11" -> DUE_DAY of December 2026 (month is 1-based here, so it lands on the next month)
export const billDueDate = (period: string) => new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), DUE_DAY);

// Next occurrence of the move-in day of the month, today included
export function nextRentDue(moveIn: Date, now = new Date()) {
  const day = moveIn.getDate();
  const make = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = make(now.getFullYear(), now.getMonth());
  return d < today ? make(now.getFullYear(), now.getMonth() + 1) : d;
}
// Rent is tracked per calendar month (same month the Payment Ledger uses)
export const rentPeriod = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
// Move-in day of the month inside `period`
export function rentDueDate(moveIn: Date, period: string) {
  const y = Number(period.slice(0, 4)), m = Number(period.slice(5, 7)) - 1;
  return new Date(y, m, Math.min(moveIn.getDate(), new Date(y, m + 1, 0).getDate()));
}
