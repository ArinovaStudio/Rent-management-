"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

type Issue = { id: string; title: string; priority: string; status: string; place: string; createdAt: string };
type ReviewItem = { id: string; kind: "PROPERTY" | "KYC"; title: string; subtitle: string; status: string; href: string };
type Data = { issues: { total: number; items: Issue[] }; review: { total: number; items: ReviewItem[] } };

const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase();
const PRIORITY_STYLE: Record<string, string> = {
  HIGH: "bg-destructive/10 text-destructive",
  MEDIUM: "bg-cream text-foreground",
  LOW: "bg-muted text-muted-foreground",
};

export default function QueuePopup({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"issues" | "review">("issues");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const showReview = role !== "PROPERTY_MANAGER";

  const load = useCallback(async () => {
    const res = await authFetch("/api/queue", { cache: "no-store" });
    if (!res.ok) { setError(true); return; }
    setError(false);
    setData(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const count = (data?.issues.total ?? 0) + (showReview ? data?.review.total ?? 0 : 0);

  return (
    <>
      <button type="button" aria-label="Issues and review queue" onClick={() => setOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">{count > 99 ? "99+" : count}</span>
        )}
      </button>

      {open && createPortal(
        <div className="tw">
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-ink/40 p-4" onClick={() => setOpen(false)}>
            <div className="mt-14 w-full max-w-md rounded-[1.75rem] bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Needs your attention</h2>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-cream"><X className="h-4 w-4" /></button>
              </div>

              <div className="mb-4 flex gap-2">
                <button type="button" onClick={() => setTab("issues")} className={`rounded-full px-4 py-1.5 text-sm ${tab === "issues" ? "bg-primary text-primary-foreground" : "bg-cream"}`}>Issues ({data?.issues.total ?? 0})</button>
                {showReview && (
                  <button type="button" onClick={() => setTab("review")} className={`rounded-full px-4 py-1.5 text-sm ${tab === "review" ? "bg-primary text-primary-foreground" : "bg-cream"}`}>Review queue ({data?.review.total ?? 0})</button>
                )}
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {error && <p className="text-sm text-destructive">Couldn&apos;t load this right now.</p>}
                {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

                {data && tab === "issues" && (
                  data.issues.items.length === 0
                    ? <p className="text-sm text-muted-foreground">No open issues.</p>
                    : data.issues.items.map((i) => (
                        <Link key={i.id} href="/dashboard/issues" onClick={() => setOpen(false)} className="block rounded-2xl bg-cream/60 p-3 hover:bg-cream">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{i.title}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLE[i.priority] ?? ""}`}>{pretty(i.priority)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{i.place} · {pretty(i.status)} · {new Date(i.createdAt).toLocaleDateString("en-IN")}</p>
                        </Link>
                      ))
                )}

                {data && tab === "review" && showReview && (
                  data.review.items.length === 0
                    ? <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
                    : data.review.items.map((r) => (
                        <Link key={`${r.kind}-${r.id}`} href={r.href} onClick={() => setOpen(false)} className="block rounded-2xl bg-cream/60 p-3 hover:bg-cream">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{r.title}</p>
                            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs">{pretty(r.status)}</span>
                          </div>
                          {r.subtitle && <p className="text-xs text-muted-foreground">{r.subtitle}</p>}
                        </Link>
                      ))
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Link href="/dashboard/issues" onClick={() => setOpen(false)} className="text-primary underline">All issues</Link>
                {role === "SUPER_ADMIN" && (
                  <>
                    <Link href="/admin/approvals" onClick={() => setOpen(false)} className="text-primary underline">Property approvals</Link>
                    <Link href="/admin/kyc" onClick={() => setOpen(false)} className="text-primary underline">KYC reviews</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}