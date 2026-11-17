"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, Copy, CreditCard, Download, QrCode, Smartphone, X } from "lucide-react";
import { qrModules } from "@/lib/qr";

export type InvoiceItem = { title: string; description?: string; rate: number; taxPct: number };
export type Payee = { name: string; upiId: string; bankName: string; accountName: string; accountNumber: string; ifsc: string };
export type InvoiceData = {
  backHref: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  paid: boolean;
  paidOn?: string;
  from: { name: string; address: string };
  to: { name: string; address: string; phone?: string };
  items: InvoiceItem[];
  terms: string[];
  note?: string | null;
  payee: Payee;
};

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const card = "rounded-[1.75rem] bg-background p-5 md:p-6";
const input = "w-full rounded-2xl bg-cream/60 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary";
const primaryBtn = "inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink";
const softBtn = "inline-flex items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70";

type Method = "qr" | "card" | "upi" | "bank";
const METHODS: { id: Method; label: string; icon: typeof QrCode }[] = [
  { id: "qr", label: "QR", icon: QrCode },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "bank", label: "Bank Account", icon: Banknote },
];

function QrImage({ text }: { text: string }) {
  const m = useMemo(() => qrModules(text), [text]);
  const border = 2;
  const n = m.length + border * 2;
  let d = "";
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + border} ${y + border}h1v1h-1z`; }));
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="mx-auto h-52 w-52 rounded-2xl bg-white" shapeRendering="crispEdges" role="img" aria-label="UPI payment QR code">
      <path d={d} fill="#000" />
    </svg>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-all text-sm font-medium">{value}</p>
      </div>
      <button type="button" aria-label={`Copy ${label}`} className="shrink-0 text-primary" onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;
}

export default function InvoiceView({ data }: { data: InvoiceData }) {
  const [method, setMethod] = useState<Method | null>(null);
  const [terms, setTerms] = useState(false);
  const [msg, setMsg] = useState("");
  const [cardF, setCardF] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [upi, setUpi] = useState("");

  const rows = data.items.map((i) => ({ ...i, tax: (i.rate * i.taxPct) / 100 }));
  const subTotal = rows.reduce((s, r) => s + r.rate, 0);
  const taxTotal = rows.reduce((s, r) => s + r.tax, 0);
  const total = Math.round((subTotal + taxTotal) * 100) / 100;

  const upiLink = `upi://pay?pa=${encodeURIComponent(data.payee.upiId)}&pn=${encodeURIComponent(data.payee.name)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${data.invoiceNo}`)}`;

  const pick = (m: Method) => { setMethod(method === m ? null : m); setMsg(""); };
  const notConnected = (e: React.FormEvent, ok: boolean, err: string) => {
    e.preventDefault();
    setMsg(ok ? "Online payments aren't connected yet. Please use the QR or bank transfer for now." : err);
  };
  const download = () => {
    const prev = document.title;
    document.title = data.invoiceNo;
    window.print();
    document.title = prev;
  };

  const StatusPill = (
    <span className={`rounded-full px-3 py-1 text-xs ${data.paid ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{data.paid ? "Paid" : "Due"}</span>
  );

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground print:bg-white">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
        <a href={data.backHref} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden"><ArrowLeft className="h-4 w-4" />Back to your details</a>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          {/* ===== Left: invoice ===== */}
          <section className={`${card} space-y-8 print:col-span-2 print:p-0`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">From</p>
                <h1 className="text-xl font-medium tracking-tight">{data.from.name}</h1>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">{data.from.address}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Invoice</p>
                <p className="text-lg font-medium">#{data.invoiceNo}</p>
                <div className="mt-1">{StatusPill}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-cream/60 px-4 py-3 sm:row-span-2">
                <p className="text-xs text-muted-foreground">Bill to</p>
                <p className="text-sm font-medium">{data.to.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.to.address}</p>
                {data.to.phone && <p className="text-sm text-muted-foreground">{data.to.phone}</p>}
              </div>
              <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Invoice #</p><p className="text-sm font-medium">{data.invoiceNo}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-medium">{data.issueDate}</p></div>
                <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Due date</p><p className="text-sm font-medium">{data.dueDate}</p></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-2 pr-4 font-medium">Description</th><th className="py-2 pr-4 text-right font-medium">Rate</th><th className="py-2 pr-4 text-right font-medium">Tax %</th><th className="py-2 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-cream align-top">
                      <td className="py-3 pr-4"><p className="font-medium">{r.title}</p>{r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}</td>
                      <td className="py-3 pr-4 text-right">{money(r.rate)}</td>
                      <td className="py-3 pr-4 text-right">{r.taxPct}%</td>
                      <td className="py-3 text-right font-medium">{money(r.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.note && <p className="rounded-2xl bg-cream/60 px-4 py-3 text-sm"><span className="text-xs text-muted-foreground">Note</span><br />{data.note}</p>}

            <div className="flex flex-wrap items-end justify-between gap-6">
              <p className="text-sm text-muted-foreground">
                By paying, you agree to the{" "}
                <button type="button" onClick={() => setTerms(true)} className="text-primary underline print:no-underline">Terms &amp; Conditions</button>.
              </p>
              <dl className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Sub total</dt><dd>{money(subTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tax total</dt><dd>{money(taxTotal)}</dd></div>
                <div className="flex justify-between border-t border-cream pt-2 text-base font-medium"><dt>Total</dt><dd>{money(total)}</dd></div>
              </dl>
            </div>
          </section>

          {/* ===== Right: sidebar ===== */}
          <aside className="space-y-5 lg:sticky lg:top-6 print:hidden">
            <section className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Invoice #{data.invoiceNo}</h2>
                {StatusPill}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-medium">{data.issueDate}</p></div>
                <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">{data.paid ? "Paid on" : "Due date"}</p><p className="text-sm font-medium">{data.paid ? data.paidOn ?? "—" : data.dueDate}</p></div>
              </div>
              <div className="mt-3 rounded-2xl bg-cream/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">Billed to</p>
                <p className="text-sm font-medium">{data.to.name}</p>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
                <p className="text-sm text-primary">{data.paid ? "Amount paid" : "Amount due"}</p>
                <p className="text-xl font-medium text-primary">{money(total)}</p>
              </div>
            </section>

            {!data.paid && (
              <section className={card}>
                <h2 className="text-lg font-semibold">Payment options</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {METHODS.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => pick(id)} aria-pressed={method === id}
                      className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${method === id ? "bg-primary text-primary-foreground" : "bg-cream/60 hover:bg-cream"}`}>
                      <Icon className="h-4 w-4 shrink-0" />{label}
                    </button>
                  ))}
                </div>

                {method === "qr" && (
                  <div className="mt-5 space-y-3 text-center">
                    <QrImage text={upiLink} />
                    <p className="text-sm font-medium">Scan to pay {money(total)}</p>
                    <p className="text-xs text-muted-foreground">Opens your phone&apos;s UPI app with the amount filled in.</p>
                  </div>
                )}

                {method === "card" && (
                  <form className="mt-5 space-y-3" onSubmit={(e) => {
                    const n = cardF.number.replace(/\D/g, "");
                    notConnected(e, n.length >= 13 && /^\d{2}\/\d{2}$/.test(cardF.expiry) && cardF.cvv.length >= 3 && !!cardF.name.trim(), "Please fill in all card details correctly.");
                  }}>
                    <Field label="Name on card"><input className={input} autoComplete="cc-name" value={cardF.name} onChange={(e) => setCardF({ ...cardF, name: e.target.value })} /></Field>
                    <Field label="Card number"><input className={input} inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={cardF.number}
                      onChange={(e) => setCardF({ ...cardF, number: e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim() })} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Expiry (MM/YY)"><input className={input} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={cardF.expiry}
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setCardF({ ...cardF, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} /></Field>
                      <Field label="CVV"><input className={input} type="password" inputMode="numeric" autoComplete="cc-csc" value={cardF.cvv}
                        onChange={(e) => setCardF({ ...cardF, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></Field>
                    </div>
                    <button type="submit" className={primaryBtn}>Pay {money(total)}</button>
                  </form>
                )}

                {method === "upi" && (
                  <form className="mt-5 space-y-3" onSubmit={(e) => notConnected(e, /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi.trim()), "Enter a valid UPI ID, e.g. name@bank")}>
                    <Field label="UPI ID"><input className={input} placeholder="name@bank" autoCapitalize="none" value={upi} onChange={(e) => setUpi(e.target.value)} /></Field>
                    <button type="submit" className={primaryBtn}>Pay {money(total)}</button>
                  </form>
                )}

                {method === "bank" && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs text-muted-foreground">Transfer {money(total)} using NEFT / IMPS / RTGS to:</p>
                    <CopyRow label="Account name" value={data.payee.accountName} />
                    <CopyRow label="Account number" value={data.payee.accountNumber} />
                    <CopyRow label="IFSC" value={data.payee.ifsc} />
                    <CopyRow label="Bank" value={data.payee.bankName} />
                    <CopyRow label="Reference / remark" value={data.invoiceNo} />
                  </div>
                )}

                {msg && <p className="mt-3 text-sm text-muted-foreground" role="status">{msg}</p>}
              </section>
            )}

            <button type="button" onClick={download} className={`${softBtn} w-full`}><Download className="h-4 w-4" />Download Bill (PDF)</button>
          </aside>
        </div>

        <p className="mt-6 px-2 text-center text-xs text-muted-foreground print:hidden">This private link is meant only for you. Please don&apos;t share it publicly.</p>
      </main>

      {terms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 print:hidden" onClick={() => setTerms(false)} role="dialog" aria-modal="true" aria-label="Terms and conditions">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Terms &amp; Conditions</h2>
              <button type="button" aria-label="Close" onClick={() => setTerms(false)}><X className="h-5 w-5" /></button>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {data.terms.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
            <button type="button" className={`${primaryBtn} mt-6`} onClick={() => setTerms(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
