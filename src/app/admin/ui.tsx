import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/admin/AdminShell";

export function PageTop({ href, title, sub, right }: { href: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-4">
      <Link href={href} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="mr-auto min-w-0">
        <h1 className="text-4xl font-medium tracking-tight">{title}</h1>
        {sub && <div className="mt-1 text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Panel className={className}>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </Panel>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return <p><span className="text-muted-foreground">{label}: </span>{children}</p>;
}

export function Tabs({ base, items, active }: { base: string; items: { key: string; label: string }[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <Link key={t.key} href={`${base}?filter=${t.key}`} className={`rounded-full px-4 py-2 text-sm ${t.key === active ? "bg-primary text-primary-foreground" : "bg-background hover:bg-cream"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export const toneFor = (status: string) =>
  ["APPROVED", "VERIFIED"].includes(status) ? "good" : ["REJECTED", "RESTRICTED"].includes(status) ? "bad" : "neutral";

export function Chip({ tone = "neutral", children }: { tone?: "good" | "bad" | "neutral"; children: ReactNode }) {
  const cls = tone === "good" ? "bg-primary/10 text-primary" : tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-cream";
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}