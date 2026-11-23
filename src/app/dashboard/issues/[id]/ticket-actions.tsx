"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";

const primary = "flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";
const soft = "flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70 disabled:cursor-not-allowed disabled:opacity-60";

// Reply box for everyone on the ticket; status update for the handler; escalate for the Property Admin.
export default function TicketActions({ issueId, status, canUpdate, canEscalate }: {
  issueId: string; status: string; canUpdate: boolean; canEscalate: boolean;
}) {
  const refresh = useSoftRefresh();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [s, setS] = useState(status);
  const [note, setNote] = useState("");
  const [askEscalate, setAskEscalate] = useState(false);
  const [escNote, setEscNote] = useState("");

  async function call(key: string, url: string, method: string, body: object, ok: string) {
    setBusy(key);
    setError("");
    try {
      const res = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Something went wrong."); toast(data.error ?? "Something went wrong.", "error"); return false; }
      toast(ok);
      refresh();
      return true;
    } catch {
      setError("Network problem. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const spin = (key: string) => busy === key && <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-medium">Add a reply</h3>
        <textarea className="field" rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a message on this ticket" />
        <button type="button" className={primary} disabled={busy !== "" || !reply.trim()} onClick={async () => { if (await call("reply", `/api/issues/${issueId}/replies`, "POST", { message: reply }, "Reply sent")) setReply(""); }}>
          {spin("reply")}{busy === "reply" ? "Sending…" : "Send reply"}
        </button>
      </div>

      {canUpdate && (
        <div className="space-y-3 border-t border-cream pt-5">
          <h3 className="font-medium">Update status</h3>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <select className="field" value={s} onChange={(e) => setS(e.target.value)}>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <textarea className="field" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the manager (optional)" />
          </div>
          <button type="button" className={primary} disabled={busy !== "" || (s === status && !note.trim())}
            onClick={async () => { if (await call("status", `/api/issues/${issueId}`, "PATCH", { status: s, resolutionNote: note }, "Ticket updated")) setNote(""); }}>
            {spin("status")}{busy === "status" ? "Saving…" : "Update ticket"}
          </button>
        </div>
      )}

      {canEscalate && (
        <div className="space-y-3 border-t border-cream pt-5">
          <h3 className="font-medium">Need the Super Admin?</h3>
          {!askEscalate ? (
            <button type="button" className={soft} onClick={() => setAskEscalate(true)}><ArrowUpRight className="h-4 w-4" />Escalate to Super Admin</button>
          ) : (
            <>
              <textarea className="field" rows={2} maxLength={2000} value={escNote} onChange={(e) => setEscNote(e.target.value)} placeholder="Why are you escalating? (optional)" />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primary} disabled={busy !== ""} onClick={() => call("escalate", `/api/issues/${issueId}/escalate`, "POST", { note: escNote }, "Escalated to Super Admin")}>
                  {spin("escalate")}{busy === "escalate" ? "Escalating…" : "Confirm escalate"}
                </button>
                <button type="button" className={soft} disabled={busy !== ""} onClick={() => setAskEscalate(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
