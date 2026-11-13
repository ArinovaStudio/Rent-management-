"use client";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardCheck, Contact, Inbox, LayoutDashboard, LogOut, Mail, PanelLeft, ShieldCheck, Users } from "lucide-react";
import { propertiesBase } from "@/lib/routes";

// TODO: point this at your real sign-out route.
const SIGN_OUT_URL = "/api/auth/logout";

type Item = { title: string; url: string; icon: typeof Inbox; superOnly?: boolean; soon?: boolean; hideFor?: string };

// Items marked `soon` are Najm sections we copied for layout only; wire them up (or delete them) later.
const NAV: Item[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, superOnly: true },
  { title: "Properties", url: "/dashboard/properties", icon: Building2 },
  { title: "Users", url: "/dashboard/users", icon: Users, hideFor: "PROPERTY_MANAGER" },
  { title: "Property approvals", url: "/admin/approvals", icon: ClipboardCheck, superOnly: true },
  { title: "KYC reviews", url: "/admin/kyc", icon: ShieldCheck, superOnly: true },
  { title: "Enquiries", url: "#", icon: Inbox, soon: true },
  { title: "Contacts", url: "#", icon: Contact, soon: true },
  { title: "Subscribers", url: "#", icon: Mail, soon: true },
];

export function AdminShell({ role, name, children }: { role: string; name?: string; children: ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const isSuper = role === "SUPER_ADMIN";
  const items = NAV.filter((n) => (!n.superOnly || isSuper) && n.hideFor !== role).map((n) => (n.title === "Properties" ? { ...n, url: propertiesBase(role) } : n));  // Most specific match wins, so /dashboard/admin/kyc doesn't also light up "Dashboard".
  const active = items.filter((n) => !n.soon && (path === n.url || path.startsWith(`${n.url}/`))).sort((a, b) => b.url.length - a.url.length)[0]?.url;
  const label = collapsed ? "lg:hidden" : "";

  return (
    <div className="tw flex min-h-screen w-full bg-cream/60 text-foreground">
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-background transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[4.5rem]" : ""}`}>
        <div className="px-3 py-5">
          <Link href={isSuper ? "/admin" : "/dashboard/properties"} className="flex items-center gap-2 text-xl font-medium tracking-tight">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">R</span>
            <span className={label}>Rental <span className="text-muted-foreground">{isSuper ? "Admin" : "Portal"}</span></span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3">
          <p className={`px-3 pb-2 text-xs font-medium text-muted-foreground ${label}`}>Manage</p>
          <ul className="space-y-1">
            {items.map((n) => {
              const on = n.url === active;
              const cls = `flex h-12 items-center gap-3 rounded-full px-3 ${on ? "bg-primary text-primary-foreground" : n.soon ? "cursor-not-allowed text-muted-foreground/60" : "hover:bg-cream"}`;
              const inner = (
                <>
                  <n.icon className="h-5 w-5 shrink-0" />
                  <span className={`text-base ${label}`}>{n.title}</span>
                  {n.soon && <span className={`ml-auto rounded-full bg-cream px-2 py-0.5 text-xs ${label}`}>Soon</span>}
                </>
              );
              return (
                <li key={n.title}>
                  {n.soon ? <span title={n.title} className={cls}>{inner}</span> : <Link href={n.url} title={n.title} onClick={() => setOpen(false)} className={cls}>{inner}</Link>}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3">
          {name && (
            <div className={`mb-2 rounded-2xl bg-cream p-3 ${label}`}>
              <p className="truncate font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{role.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          )}
          <a href={SIGN_OUT_URL} title="Sign out" className="flex h-10 items-center gap-3 rounded-full px-3 hover:bg-cream">
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={label}>Sign out</span>
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-background/90 px-4 backdrop-blur">
          <button type="button" aria-label="Toggle sidebar" onClick={() => (window.innerWidth >= 1024 ? setCollapsed((c) => !c) : setOpen((o) => !o))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream">
            <PanelLeft className="h-5 w-5" />
          </button>
          <p className="truncate text-sm text-muted-foreground">Rental admin panel</p>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-medium tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-[1.75rem] bg-background p-5 md:p-6 ${className}`}>{children}</div>;
}

export const STATUS_STYLE: Record<string, string> = {
  New: "bg-primary text-primary-foreground",
  Contacted: "bg-cream text-foreground",
  Viewing: "bg-ink text-ink-foreground",
  Closed: "bg-muted text-muted-foreground",
};
