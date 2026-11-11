import type { HistoryEvent } from "@/lib/audit";

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function HistoryList({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) return <p className="muted">No history yet.</p>;
  return (
    <ul style={{ paddingLeft: 18, margin: 0 }}>
      {events.map((e) => (
        <li key={e.id}>
          {fmt(e.createdAt)} · {e.actorName}: {e.action.replace(/_/g, " ").toLowerCase()} ({e.fromStatus} → {e.toStatus})
          {e.note && <div className="muted">“{e.note}”</div>}
        </li>
      ))}
    </ul>
  );
}
