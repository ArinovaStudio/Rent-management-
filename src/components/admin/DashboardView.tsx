"use client";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Building2, Eye, Inbox, Plus, Wallet } from "lucide-react";
import { Panel, STATUS_STYLE } from "@/components/admin/AdminShell";

// recharts needs real colour strings, not Tailwind channel variables
const PRIMARY = "oklch(0.42 0.085 158)";
const INK = "oklch(0.14 0 0)";
const CREAM = "oklch(0.96 0.018 85)";
const PALETTE = [PRIMARY, INK, "oklch(0.75 0.06 85)", "oklch(0.62 0.07 158)", "oklch(0.85 0.03 85)"];

type Status = "NEW" | "CONTACTED" | "VISIT_SCHEDULED" | "CLOSED" | "NOT_INTERESTED";
type DashboardStats = {
  pipeline: Record<Status, number>;
  totalEnquiries: number; totalViews: number; liveListings: number; portfolioValue: number; conversionRate: number;
  sources: { name: string; value: number }[];
  byCity: { name: string; value: number }[];
  trend: { day: string; views: number; enquiries: number }[];
  recentEnquiries: { id: string; name: string; message: string; status: Status; createdAt: string }[];
  topViewed: { id: string; title: string; views: number; image: string | null }[];
};

// PLACEHOLDER DATA: replace with real numbers when the dashboard API exists (UI only for now).
const SAMPLE: DashboardStats = {
  pipeline: { NEW: 6, CONTACTED: 9, VISIT_SCHEDULED: 4, CLOSED: 7, NOT_INTERESTED: 2 },
  totalEnquiries: 28, totalViews: 4820, liveListings: 12, portfolioValue: 36500000, conversionRate: 25,
  sources: [{ name: "Website", value: 14 }, { name: "Phone", value: 8 }, { name: "Referral", value: 6 }],
  byCity: [{ name: "Indore", value: 5 }, { name: "Ujjain", value: 3 }, { name: "Ratlam", value: 2 }, { name: "Bhopal", value: 2 }],
  trend: Array.from({ length: 14 }, (_, i) => ({ day: `${i + 1} Nov`, views: 120 + ((i * 53) % 90), enquiries: (i * 5) % 9 })),
  recentEnquiries: [
    { id: "1", name: "Aarav Sharma", message: "Is the 2-sharing room still available?", status: "NEW", createdAt: "12 Nov" },
    { id: "2", name: "Priya Verma", message: "Can I visit this weekend?", status: "VISIT_SCHEDULED", createdAt: "11 Nov" },
    { id: "3", name: "Rahul Jain", message: "What is the security deposit?", status: "CONTACTED", createdAt: "10 Nov" },
  ],
  topViewed: [
    { id: "1", title: "Premium furnished PG", views: 940, image: null },
    { id: "2", title: "2 BHK near the station", views: 610, image: null },
    { id: "3", title: "Studio flat, city centre", views: 380, image: null },
  ],
};

const PIPELINE = [
  { key: "NEW", label: "New" }, { key: "CONTACTED", label: "Contacted" }, { key: "VISIT_SCHEDULED", label: "Visit scheduled" },
  { key: "CLOSED", label: "Closed" }, { key: "NOT_INTERESTED", label: "Not interested" },
] as const;
const STATUS_LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", VISIT_SCHEDULED: "Viewing", CLOSED: "Closed", NOT_INTERESTED: "Not interested" };

export default function DashboardView({ name }: { name: string }) {
  const live = SAMPLE;
  const compact = Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(live.portfolioValue);
  const stats = [
    { label: "Total listing views", value: live.totalViews.toLocaleString("en-IN"), icon: Eye },
    { label: "New enquiries", value: String(live.pipeline.NEW), icon: Inbox },
    { label: "Active listings", value: String(live.liveListings), icon: Building2 },
    { label: "Portfolio value", value: `₹${compact}`, icon: Wallet },
    { label: "Conversion", value: `${live.conversionRate}%`, icon: ArrowUpRight },
  ];
  const maxViews = Math.max(1, live.topViewed[0]?.views ?? 1);
  const pipeline = PIPELINE.map((st, i) => ({ status: st.label, n: live.pipeline[st.key], color: PALETTE[i]! }));
  const pipelineTotal = live.totalEnquiries;

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary p-8 text-primary-foreground md:p-10">
          <p className="opacity-70">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight md:text-5xl">Welcome back, {name.split(" ")[0] || "Admin"}</h1>
          <p className="mt-3 max-w-lg text-lg opacity-80">You have {live.pipeline.NEW} new enquiries waiting and {live.liveListings} listings live on the site.</p>
          <div className="relative z-10 mt-8 flex flex-wrap gap-2">
            <Link href="/admin/properties/new" className="flex items-center gap-2 rounded-full bg-background px-5 py-3 text-foreground hover:bg-cream"><Plus className="h-4 w-4" />Add property</Link>
            <Link href="/admin/properties" className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-5 py-3 hover:bg-primary-foreground/25"><Building2 className="h-4 w-4" />View properties</Link>
          </div>
          <p aria-hidden className="pointer-events-none absolute -bottom-10 right-6 select-none text-[10rem] font-medium leading-none tracking-tighter opacity-[0.06]">Rental</p>
        </div>
        <Panel>
          <p className="text-xl font-medium">Enquiry pipeline</p>
          <p className="text-sm text-muted-foreground">{pipelineTotal} enquiries in total</p>
          <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-cream">
            {pipeline.map((s) => <div key={s.status} style={{ width: `${(s.n / Math.max(1, pipelineTotal)) * 100}%`, background: s.color }} />)}
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3">
            {pipeline.map((s) => (
              <li key={s.status} className="rounded-2xl bg-cream p-4">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.status}</span>
                <p className="mt-1 text-3xl font-medium tracking-tight">{s.n}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s, i) => (
          <Panel key={s.label} className="transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-primary"><s.icon className="h-5 w-5" /></span>
              <span className="text-sm text-primary">+{[12, 8, 3, 6, 2][i]}%</span>
            </div>
            <p className="mt-6 text-3xl font-medium tracking-tight">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel>
          <p className="text-xl font-medium">Traffic & enquiries · last 14 days</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={live.trend}>
                <CartesianGrid vertical={false} stroke={CREAM} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="v" tickLine={false} axisLine={false} fontSize={12} width={36} />
                <YAxis yAxisId="e" orientation="right" tickLine={false} axisLine={false} fontSize={12} width={24} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 16, border: "none" }} />
                <Area yAxisId="v" type="monotone" dataKey="views" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.12} strokeWidth={2} />
                <Area yAxisId="e" type="monotone" dataKey="enquiries" stroke={INK} fill={INK} fillOpacity={0.06} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <p className="text-xl font-medium">Enquiry sources</p>
          <div className="mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={live.sources} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {live.sources.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 16, border: "none" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {live.sources.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{s.name}<span className="ml-auto font-medium">{s.value}</span></li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-xl font-medium">Recent enquiries</p>
            <span className="text-sm text-primary">View all</span>
          </div>
          <ul className="mt-4 divide-y divide-cream">
            {live.recentEnquiries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream font-medium">{e.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{e.message}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[STATUS_LABEL[e.status]!] ?? "bg-muted text-muted-foreground"}`}>{STATUS_LABEL[e.status]}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{e.createdAt}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <p className="text-xl font-medium">Most viewed properties</p>
          <ul className="mt-4 space-y-4">
            {live.topViewed.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="h-12 w-12 rounded-xl bg-cream" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-cream"><div className="h-full rounded-full bg-primary" style={{ width: `${(p.views / maxViews) * 100}%` }} /></div>
                </div>
                <span className="text-sm text-muted-foreground">{p.views.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <p className="text-xl font-medium">Listings by city</p>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={live.byCity} margin={{ top: 16, right: 0, left: 0, bottom: 0 }} barCategoryGap="5%">
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} interval={0} tickMargin={12} tickFormatter={(v: string) => (v.length > 8 ? `${v.substring(0, 8)}...` : v)} />
                <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(2, Math.ceil(max * 1.8))]} />
                <Tooltip cursor={{ fill: CREAM }} contentStyle={{ borderRadius: 16, border: "none" }} formatter={(v) => [Number(v).toLocaleString("en-IN"), "Listings"]} />
                <Bar dataKey="value" fill={PRIMARY} radius={[12, 12, 0, 0]} minPointSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">— contacts in your address book</p>
        </Panel>
      </div>
    </div>
  );
}
