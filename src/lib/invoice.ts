// Shared types + helpers for the invoice-style rent and bill pages.

// `key` says which saved tax rate a line uses: "RENT", "AMENITY:<name>" or "BILL". Lines without a key can't have their tax edited.
export type InvoiceItem = { key?: string; title: string; description?: string; rate: number; taxPct: number };

export type InvoiceData = {
  invoiceNo: string;
  kind: "RENT" | "BILL";
  periodLabel: string;
  status: "DUE" | "PAID";
  paidOn: string | null;
  from: { name: string; lines: string[] };
  to: { name: string; lines: string[]; phone: string; email: string | null };
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  terms: string[];
  backHref: string;
  backLabel?: string; // text of the back link, defaults to "Back to your details"
  splitPeople?: number; // people living under this tenancy, used as the default for the split
  payee: { upiId: string; name: string; demo: boolean };
};

// Staff-only extras for InvoiceView
// draft: the invoice is a new bill that staff are filling in (units and rate), then saving.
export type DraftBill = { allocationId: string; type: "ELECTRICITY" | "WATER"; category: string; initialPeriod: string; minPeriod: string; maxPeriod: string }; // months allowed: move-in month up to this month
// taxEdit: staff may change the tax % of each line. billId is set on a saved bill's own page.
export type TaxEdit = { allocationId: string; billId?: string };

// ---- Tax ----
// Tax % saved for a tenant's rent and amenities: { "RENT": 5, "AMENITY:Gym": 18 }. Anything missing is 0%.
export type TaxRates = Record<string, number>;
export const RENT_TAX_KEY = "RENT";
export const amenityTaxKey = (name: string) => `AMENITY:${name}`;

// A tax % from user input: 0 to 100, at most 2 decimals. null = not valid.
export function cleanPct(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function taxRatesOf(raw: unknown): TaxRates {
  const out: TaxRates = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const pct = cleanPct(v);
      if (pct !== null) out[k] = pct;
    }
  }
  return out;
}

// amount + tax, to the paisa
export const withTax = (amount: number, pct: number) => Math.round((amount + (amount * pct) / 100) * 100) / 100;

export const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function invoiceTotals(items: InvoiceItem[]) {
  const sub = items.reduce((s, i) => s + i.rate, 0);
  const tax = items.reduce((s, i) => s + (i.rate * i.taxPct) / 100, 0);
  return { sub, tax, total: Math.round((sub + tax) * 100) / 100 };
}

export const RENT_TERMS = [
  "Rent is payable on or before the due date every month.",
  "Late payment may attract a late fee as agreed with the property owner or manager.",
  "The security deposit is refundable at check-out after adjusting any dues or damages.",
  "Electricity, water and other utility charges are billed separately.",
  "Please keep your payment confirmation until the payment shows as received.",
  "Disputes about this invoice should be raised with the property manager within 7 days.",
];

export const BILL_TERMS = [
  "The bill must be paid on or before the due date.",
  "Charges are based on the usage recorded for the billing month shown above.",
  "Unpaid bills may be added to the next invoice or adjusted against the security deposit.",
  "Please keep your payment confirmation until the payment shows as received.",
  "Disputes about this bill should be raised with the property manager within 7 days.",
];

// Payee UPI id. Properties have no UPI field yet, so it comes from the environment for now:
//   PAYEE_UPI_ID=owner@bank   (optional: PAYEE_NAME=Owner name)
// Outside production a demo id is used so the QR can be previewed; the page shows a warning for it.
export function payeeFor(propertyName: string) {
  const upiId = process.env.PAYEE_UPI_ID ?? "";
  if (upiId) return { upiId, name: process.env.PAYEE_NAME || propertyName, demo: false };
  return { upiId: process.env.NODE_ENV === "production" ? "" : "demo@upi", name: propertyName, demo: true };
}

export function propertyLines(p: { address: string; city: string; state?: string | null }) {
  return [p.address, [p.city, p.state].filter(Boolean).join(", ")].filter(Boolean);
}
