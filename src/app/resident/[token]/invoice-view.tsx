"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Banknote, Check, CreditCard, Download, Landmark, QrCode, Smartphone, Users, X } from "lucide-react";
import { qrModules } from "@/lib/qr";
import { invoiceTotals, money, type InvoiceData } from "@/lib/invoice";

const fieldCls = "w-full rounded-2xl bg-cream/60 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";

function QrSvg({ text }: { text: string }) {
  const { n, d } = useMemo(() => {
    try {
      const m = qrModules(text);
      let path = "";
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) path += `M${x + 2},${y + 2}h1v1h-1z`;
      return { n: m.length + 4, d: path };
    } catch {
      return { n: 0, d: "" }; // payload too long for the encoder
    }
  }, [text]);
  if (!n) return <p className="text-xs text-destructive">Couldn&apos;t generate the QR for this payment.</p>;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="mx-auto h-48 w-48 rounded-2xl bg-white" shapeRendering="crispEdges" role="img" aria-label="UPI payment QR code">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

type Method = "qr" | "card" | "upi" | "bank";
type Mode = "full" | "equal" | "custom";

export default function InvoiceView({ invoice }: { invoice: InvoiceData }) {
  const [termsOpen, setTermsOpen] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [mode, setMode] = useState<Mode>("full");
  const [people, setPeople] = useState(2);
  const [mine, setMine] = useState("");
  const [copied, setCopied] = useState(false);

  const { sub, tax, total } = invoiceTotals(invoice.items);
  const paid = invoice.status === "PAID";

  // ---- split maths, in paise so nothing gets lost to rounding ----
  const totalPaise = Math.round(total * 100);
  const each = Math.floor(totalPaise / people);
  const equalMine = totalPaise - each * (people - 1); // the person paying first absorbs the odd paise
  const customMinePaise = Math.min(totalPaise, Math.max(0, Math.round((Number(mine) || 0) * 100)));
  const customRemaining = totalPaise - customMinePaise;
  const payPaise = mode === "full" ? totalPaise : mode === "equal" ? equalMine : customMinePaise;
  const pay = payPaise / 100;

  const upiLink = `upi://pay?pa=${encodeURIComponent(invoice.payee.upiId)}&pn=${encodeURIComponent(invoice.payee.name)}&am=${pay.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNo)}`;

  function download() {
    const prev = document.title;
    document.title = invoice.invoiceNo;
    window.print();
    document.title = prev;
  }
  function copyShare() {
    const msg = `Hi! My share for ${invoice.invoiceNo} (${invoice.periodLabel}) is ${money(each / 100)} each. Total ${money(total)}.${invoice.payee.upiId ? ` Please pay me on UPI.` : ""}`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const methods: [Method, string, typeof QrCode][] = [["qr", "QR code", QrCode], ["card", "Card", CreditCard], ["upi", "UPI ID", Smartphone], ["bank", "Bank account", Landmark]];
  const seg = (on: boolean) => `flex-1 rounded-full px-3 py-2 text-xs ${on ? "bg-primary text-primary-foreground" : "bg-cream hover:bg-cream/70"}`;

  const terms = (
    <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-gray-600">
      {invoice.terms.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap gap-6 lg:flex-nowrap print:block print:max-w-none">
      {/* ================= Invoice (left) ================= */}
      <div className="w-full flex-[2] lg:max-w-3xl print:max-w-none">
        <div className="rounded-[1.75rem] bg-white p-6 shadow-sm md:p-10 print:rounded-none print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 text-[13px] text-gray-700">
              <p className="text-base font-semibold text-gray-900">{invoice.from.name}</p>
              {invoice.from.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
            <div className="text-right">
              <p className="text-3xl font-light uppercase tracking-wide text-gray-800 md:text-4xl">Invoice</p>
              <p className="mt-1 text-sm text-gray-500">{invoice.invoiceNo}</p>
              {paid && <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Paid</span>}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-between gap-6 text-[13px]">
            <div className="space-y-0.5">
              <p className="mb-1 text-sm font-semibold text-gray-800">Bill to</p>
              <p className="font-medium text-gray-900">{invoice.to.name}</p>
              {invoice.to.lines.map((l) => <p key={l} className="text-gray-700">{l}</p>)}
              <p className="text-gray-700">{invoice.to.phone}</p>
              {invoice.to.email && <p className="text-gray-700">{invoice.to.email}</p>}
            </div>
            <dl className="w-56 space-y-1.5">
              {([["Invoice#", invoice.invoiceNo], ["Date", invoice.issueDate], ["Due date", invoice.dueDate]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-gray-500">{k}</dt><dd className="text-right font-medium text-gray-900">{v}</dd></div>
              ))}
            </dl>
          </div>

          {/* Items */}
          <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-12 bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
              <div className="col-span-6">Title / Description</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Tax %</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            {invoice.items.map((it) => (
              <div key={it.title} className="grid grid-cols-12 items-start border-t border-gray-100 px-4 py-3 text-sm">
                <div className="col-span-6 pr-2">
                  <p className="font-medium text-gray-900">{it.title}</p>
                  {it.description && <p className="text-xs text-gray-500">{it.description}</p>}
                </div>
                <div className="col-span-2 text-right">{money(it.rate)}</div>
                <div className="col-span-2 text-right">{it.taxPct}%</div>
                <div className="col-span-2 text-right font-medium">{money(it.rate + (it.rate * it.taxPct) / 100)}</div>
              </div>
            ))}
          </div>

          {/* Terms + totals */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-xs">
              <button type="button" onClick={() => setTermsOpen(true)} className="text-sm font-medium text-primary underline print:hidden">Terms &amp; Conditions</button>
              <div className="hidden print:block">
                <p className="mb-1 text-sm font-medium text-gray-800">Terms &amp; Conditions</p>
                {terms}
              </div>
            </div>
            <div className="w-64 space-y-2 text-[13px]">
              <div className="flex justify-between"><span>Sub total</span><span>{money(sub)}</span></div>
              <div className="flex justify-between"><span>Tax total</span><span>{money(tax)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold"><span>Total</span><span>{money(total)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= Sidebar (right) ================= */}
      <aside className="w-full self-start lg:w-80 print:hidden">
        <div className="space-y-5 rounded-[1.75rem] bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <a href={invoice.backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to your details</a>

          <div>
            <h2 className="text-lg font-semibold">Invoice #{invoice.invoiceNo}</h2>
            <div className="mt-3 h-px bg-gray-100" />
            <dl className="mt-3 space-y-2 text-sm">
              {([
                ["Status", paid ? `Paid${invoice.paidOn ? ` on ${invoice.paidOn}` : ""}` : "Due"],
                ["Period", invoice.periodLabel],
                ["Billed to", invoice.to.name],
                ["Date", invoice.issueDate],
                ["Due date", invoice.dueDate],
                ["Total", money(total)],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-gray-500">{k}</dt><dd className={`text-right font-medium ${k === "Status" ? (paid ? "text-primary" : "text-destructive") : ""}`}>{v}</dd></div>
              ))}
            </dl>
          </div>

          {!paid && (
            <>
              {/* Split */}
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" />Living with others?</p>
                <div className="flex gap-2">
                  <button type="button" className={seg(mode === "full")} onClick={() => setMode("full")}>Pay full</button>
                  <button type="button" className={seg(mode === "equal")} onClick={() => setMode("equal")}>Split equally</button>
                  <button type="button" className={seg(mode === "custom")} onClick={() => setMode("custom")}>My amount</button>
                </div>

                {mode !== "full" && (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>People sharing</span>
                    <span className="flex items-center gap-3">
                      <button type="button" aria-label="Fewer people" className="h-8 w-8 rounded-full bg-cream" onClick={() => setPeople(Math.max(2, people - 1))}>−</button>
                      <span className="w-4 text-center font-medium">{people}</span>
                      <button type="button" aria-label="More people" className="h-8 w-8 rounded-full bg-cream" onClick={() => setPeople(Math.min(10, people + 1))}>+</button>
                    </span>
                  </label>
                )}

                {mode === "equal" && (
                  <p className="rounded-2xl bg-cream/60 px-4 py-3 text-xs text-gray-600">
                    Everyone pays {money(each / 100)}{equalMine !== each ? ` (you pay ${money(equalMine / 100)} to cover the odd paise)` : ""}. Share this link so each person can pay their part.
                  </p>
                )}

                {mode === "custom" && (
                  <div className="space-y-2">
                    <label className="block text-sm">Amount you will pay
                      <input className={`${fieldCls} mt-1`} type="number" min={0} max={total} inputMode="decimal" value={mine} onChange={(e) => setMine(e.target.value)} placeholder="₹ 0" />
                    </label>
                    <p className={`rounded-2xl px-4 py-2.5 text-xs ${customRemaining === 0 ? "bg-primary/10 text-primary" : "bg-cream/60 text-gray-600"}`}>
                      Remaining <span className="font-semibold">{money(customRemaining / 100)} / {money(total)}</span>
                      {customRemaining > 0 && people > 1 ? ` · about ${money(customRemaining / 100 / (people - 1))} each for the other ${people - 1}` : ""}
                    </p>
                  </div>
                )}

                {mode === "full" && (
                  <details className="rounded-2xl bg-cream/60 px-4 py-3 text-xs text-gray-600">
                    <summary className="cursor-pointer text-sm font-medium text-gray-800">Pay now, split with friends later</summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>People sharing</span>
                        <span className="flex items-center gap-3">
                          <button type="button" aria-label="Fewer people" className="h-7 w-7 rounded-full bg-background" onClick={() => setPeople(Math.max(2, people - 1))}>−</button>
                          <span className="w-4 text-center font-medium">{people}</span>
                          <button type="button" aria-label="More people" className="h-7 w-7 rounded-full bg-background" onClick={() => setPeople(Math.min(10, people + 1))}>+</button>
                        </span>
                      </div>
                      <p>Each friend owes you <span className="font-semibold">{money(each / 100)}</span>.</p>
                      <button type="button" onClick={copyShare} className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-xs hover:bg-cream">
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy message for friends"}
                      </button>
                    </div>
                  </details>
                )}
              </div>

              {/* Payment */}
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <p className="text-sm font-medium">Payment options</p>
                  <p className="text-right text-xs text-gray-500">You pay<br /><span className="text-base font-semibold text-gray-900">{money(pay)}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {methods.map(([k, label, Icon]) => (
                    <button key={k} type="button" onClick={() => setMethod(method === k ? null : k)}
                      className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm ${method === k ? "border-primary bg-primary/5" : "border-transparent bg-cream/60 hover:bg-cream"}`}>
                      <Icon className="h-4 w-4 text-primary" />{label}
                    </button>
                  ))}
                </div>

                {method === "qr" && (
                  <div className="space-y-2 rounded-2xl bg-cream/60 p-4 text-center">
                    {invoice.payee.upiId && pay > 0 ? (
                      <>
                        <QrSvg text={upiLink} />
                        <p className="text-xs text-gray-600">Scan with any UPI app. The amount {money(pay)} is filled in for you.</p>
                        {invoice.payee.demo && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">Demo QR: the owner has not added a UPI ID yet. Don&apos;t pay with it.</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-600">{pay > 0 ? "The owner has not added a UPI ID yet, so a QR can't be made." : "Enter an amount above to generate the QR."}</p>
                    )}
                  </div>
                )}

                {method === "upi" && (
                  <div className="space-y-2 rounded-2xl bg-cream/60 p-4">
                    <label className="block text-xs">Your UPI ID<input className={`${fieldCls} mt-1 bg-background`} placeholder="name@bank" autoComplete="off" /></label>
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground opacity-50">Pay {money(pay)}</button>
                    <p className="text-[11px] text-gray-500">Online payment will be switched on soon.</p>
                  </div>
                )}

                {method === "card" && (
                  <div className="space-y-2 rounded-2xl bg-cream/60 p-4">
                    <input className={`${fieldCls} bg-background`} placeholder="Name on card" autoComplete="off" />
                    <input className={`${fieldCls} bg-background`} placeholder="Card number" inputMode="numeric" maxLength={19} autoComplete="off"
                      onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={`${fieldCls} bg-background`} placeholder="MM/YY" maxLength={5} autoComplete="off"
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }} />
                      <input className={`${fieldCls} bg-background`} placeholder="CVV" type="password" inputMode="numeric" maxLength={4} autoComplete="off" />
                    </div>
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground opacity-50">Pay {money(pay)}</button>
                    <p className="text-[11px] text-gray-500">Online payment will be switched on soon. Card details are not stored.</p>
                  </div>
                )}

                {method === "bank" && (
                  <div className="space-y-2 rounded-2xl bg-cream/60 p-4">
                    <input className={`${fieldCls} bg-background`} placeholder="Account holder name" autoComplete="off" />
                    <input className={`${fieldCls} bg-background`} placeholder="Account number" inputMode="numeric" autoComplete="off" />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={`${fieldCls} bg-background uppercase`} placeholder="IFSC code" maxLength={11} autoComplete="off" />
                      <input className={`${fieldCls} bg-background`} placeholder="Bank name" autoComplete="off" />
                    </div>
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground opacity-50">Pay {money(pay)}</button>
                    <p className="text-[11px] text-gray-500">Online payment will be switched on soon. Bank details are not stored.</p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <button type="button" onClick={download} className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-white hover:bg-primary">
              <Download className="h-4 w-4" />Download Bill (PDF)
            </button>
            <p className="text-center text-[11px] text-gray-500">Choose “Save as PDF” in the window that opens.</p>
          </div>
        </div>
      </aside>

      {termsOpen && typeof document !== "undefined" && createPortal(
        <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Terms and conditions" onClick={() => setTermsOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-foreground" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Terms &amp; Conditions</h3>
              <button type="button" aria-label="Close" onClick={() => setTermsOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {terms}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
