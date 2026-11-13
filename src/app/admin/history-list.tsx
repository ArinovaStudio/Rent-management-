import type { HistoryEvent } from "@/lib/audit";

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function HistoryList({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) return <p className="text-muted-foreground">No history yet.</p>;
  return (
    <ul className="divide-y divide-cream">
      {events.map((e) => (
        <li key={e.id} className="py-3">
          <p>{fmt(e.createdAt)} · {e.actorName}: {e.action.replace(/_/g, " ").toLowerCase()} <span className="text-muted-foreground">({e.fromStatus} → {e.toStatus})</span></p>
          {e.note && <p className="mt-1 text-muted-foreground">“{e.note}”</p>}
        </li>
      ))}
    </ul>
  );
}