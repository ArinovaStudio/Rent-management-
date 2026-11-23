"use client";
import { useState } from "react";
import { Droplets, FileText, Wallet, Zap, type LucideIcon } from "lucide-react";

export type BillItem = {
  id: string; period: string; label: string; amount: number; note: string | null; paid: boolean; paidOn: string | null; dueDate: string;
};
export type RentItem = { period: string; label: string; amount: number; paidOn: string };
export type HistoryItem = { key: string; sort: number; kind: string; label: string; amount: number; paidOn: string; href: string };

type Props = {
  token: string;
  rent: { covered: boolean; label: string; amount: number; paid: boolean; paidOn: string | null; dueDate: string; past: RentItem[] };
  bills: { ELECTRICITY: BillItem[]; WATER: BillItem[] }; // newest first; the first one is the current bill
  history: HistoryItem[];
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const card = "rounded-[1.75rem] bg-background p-5 md:p-6";
const pill = "inline-flex items-center rounded-full px-5 py-2.5 text-sm";
const primaryBtn = `${pill} bg-primary text-primary-foreground hover:bg-ink`;
const softBtn = `${pill} bg-cream hover:bg-cream/70`;
const offBtn = `${pill} cursor-not-allowed bg-primary text-primary-foreground opacity-40`;
const status = (paid: boolean) => `rounded-full px-3 py-1 text-xs ${paid ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`;

const BILL_META: Record<"ELECTRICITY" | "WATER", { name: string; icon: LucideIcon }> = {
  ELECTRICITY: { name: "Electricity", icon: Zap },
  WATER: { name: "Water", icon: Droplets },
};

function Tile({ icon: Icon, title, line, ok, none }: { icon: LucideIcon; title: string; line: string; ok: boolean; none?: boolean }) {
  return (
    <div className={`${card} flex items-center gap-4 !p-4`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`text-sm font-medium ${none ? "" : ok ? "text-primary" : "text-destructive"}`}>{line}</p>
      </div>
    </div>
  );
}

function PastTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl bg-cream/60">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-xs text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-background">{r.map((c, k) => <td key={k} className="px-4 py-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function ResidentView({ token, rent, bills, history }: Props) {
  const [tab, setTab] = useState<"rent" | "bills" | "history">("rent");
  const [kind, setKind] = useState<"ELECTRICITY" | "WATER">("ELECTRICITY");

  const cur = (k: "ELECTRICITY" | "WATER") => bills[k][0];
  const tileLine = (k: "ELECTRICITY" | "WATER") => { const b = cur(k); return !b ? "No bill yet" : b.paid ? `${b.label} · Paid` : `${b.label} · Due ${inr(b.amount)}`; };
  const billPaid = (k: "ELECTRICITY" | "WATER") => !cur(k) || cur(k).paid;

  const tabs = [["rent", "Rent"], ["bills", "My Bills"], ["history", "Payment history"]] as const;
  const current = cur(kind);
  const past = bills[kind].slice(1);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={Wallet} title="Rent" none={rent.covered} ok={rent.paid} line={rent.covered ? "Covered by main tenant" : rent.paid ? `${rent.label} · Paid` : `${rent.label} · Due ${inr(rent.amount)}`} />
        <Tile icon={Zap} title="Electricity" ok={billPaid("ELECTRICITY")} none={!cur("ELECTRICITY")} line={tileLine("ELECTRICITY")} />
        <Tile icon={Droplets} title="Water" ok={billPaid("WATER")} none={!cur("WATER")} line={tileLine("WATER")} />
      </div>

      <div role="tablist" className="flex gap-2 overflow-x-auto rounded-full bg-background p-1.5">
        {tabs.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm ${tab === id ? "bg-primary text-primary-foreground" : "hover:bg-cream"}`}>{name}</button>
        ))}
      </div>

      {tab === "rent" && (
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Rent · {rent.label}</h2>
              <p className="text-sm text-muted-foreground">{rent.covered ? "Your rent is paid by the main tenant of this flat." : rent.paid ? `Paid on ${rent.paidOn}` : `Due ${rent.dueDate}`}</p>
            </div>
            {!rent.covered && <span className={status(rent.paid)}>{rent.paid ? "Paid" : "Unpaid"}</span>}
          </div>
          {!rent.covered && (
            <>
              <p className="mt-4 text-3xl font-medium">{inr(rent.amount)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {rent.paid
                  ? <button type="button" disabled className={offBtn}>Pay rent</button>
                  : <a className={primaryBtn} href={`/resident/${token}/rent`}>Pay rent</a>}
                <a className={softBtn} href={`/resident/${token}/rent`}>View invoice</a>
              </div>
              {rent.paid && <p className="mt-3 text-sm text-muted-foreground">Rent for {rent.label} is paid. Next month&apos;s rent can be paid once it starts.</p>}

              <h3 className="mt-6 text-sm font-semibold">Past rent payments</h3>
              {rent.past.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No earlier rent payments yet.</p> : (
                <PastTable head={["Month", "Amount", "Paid on", ""]} rows={rent.past.map((p) => [p.label, inr(p.amount), p.paidOn, <a key={p.period} className="text-primary underline" href={`/resident/${token}/rent?period=${p.period}`}>View</a>])} />
              )}
            </>
          )}
        </section>
      )}

      {tab === "bills" && (
        <section className={card}>
          <h2 className="text-lg font-semibold">My Bills</h2>
          <div role="tablist" className="mt-4 flex gap-2">
            {(["ELECTRICITY", "WATER"] as const).map((k) => {
              const Icon = BILL_META[k].icon;
              return (
                <button key={k} role="tab" aria-selected={kind === k} type="button" onClick={() => setKind(k)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm ${kind === k ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                  <Icon className="h-4 w-4" />{BILL_META[k].name}
                </button>
              );
            })}
          </div>

          {!current ? (
            <p className="mt-5 text-sm text-muted-foreground">No {BILL_META[kind].name.toLowerCase()} bill has been added yet.</p>
          ) : (
            <div className="mt-5 rounded-2xl bg-cream/60 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current bill · {current.label}</p>
                  <p className="text-3xl font-medium">{inr(current.amount)}</p>
                  {current.note && <p className="mt-1 text-sm text-muted-foreground">{current.note}</p>}
                </div>
                <span className={status(current.paid)}>{current.paid ? "Paid" : "Unpaid"}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-background px-4 py-3"><p className="text-xs text-muted-foreground">Due date</p><p className="text-sm font-medium">{current.dueDate}</p></div>
                <div className="rounded-2xl bg-background px-4 py-3"><p className="text-xs text-muted-foreground">Paid on</p><p className="text-sm font-medium">{current.paidOn ?? "—"}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {current.paid
                  ? <button type="button" disabled className={offBtn}>Pay bill</button>
                  : <a className={primaryBtn} href={`/resident/${token}/bill/${current.id}`}>Pay bill</a>}
                <a className={softBtn} href={`/resident/${token}/bill/${current.id}`}>View invoice</a>
              </div>
              {current.paid && <p className="mt-3 text-sm text-muted-foreground">This bill is paid. You can pay again when a new {BILL_META[kind].name.toLowerCase()} bill is generated.</p>}
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold">Past {BILL_META[kind].name.toLowerCase()} bills</h3>
          {past.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No earlier bills.</p> : (
            <PastTable head={["Month", "Amount", "Status", "Paid on", ""]} rows={past.map((b) => [
              b.label, inr(b.amount), <span key="s" className={status(b.paid)}>{b.paid ? "Paid" : "Unpaid"}</span>, b.paidOn ?? "—",
              <a key="v" className="text-primary underline" href={`/resident/${token}/bill/${b.id}`}>View</a>,
            ])} />
          )}
        </section>
      )}

      {tab === "history" && (
        <section className={card}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-semibold">Payment history</h2><p className="text-sm text-muted-foreground">Every rent and bill payment you have made.</p></div>
          </div>
          {history.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No payments yet.</p> : (
            <PastTable head={["Paid on", "For", "Amount", ""]} rows={history.map((h) => [
              h.paidOn, <span key="f"><span className="block font-medium">{h.kind}</span><span className="text-xs text-muted-foreground">{h.label}</span></span>, inr(h.amount),
              <a key="v" className="text-primary underline" href={h.href}>View</a>,
            ])} />
          )}
        </section>
      )}
    </div>
  );
}
