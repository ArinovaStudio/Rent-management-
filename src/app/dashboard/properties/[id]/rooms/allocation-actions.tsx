"use client";
import { useRouter } from "next/navigation";

export default function AllocationActions({ allocationId, residentUrl }: { allocationId: string; residentUrl: string }) {
  const router = useRouter();

  async function checkout() {
    if (!window.confirm("Check this resident out? Their bed will become available.")) return;

    const send = () => fetch(`/api/allocations/${allocationId}`, { method: "PATCH" });
    let res = await send();
    if (res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST" })).ok) {
      res = await send();
    }
    if (res.ok) {
      router.refresh();
    } else {
      alert((await res.json().catch(() => ({}))).error ?? "Could not check out resident.");
    }
  }

  const btn = "rounded-full bg-background px-4 py-2 text-sm hover:bg-background/70";
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} onClick={() => navigator.clipboard.writeText(`${window.location.origin}${residentUrl}`)}>
        Copy link
      </button>
      <button type="button" className={btn} onClick={checkout}>Check out</button>
    </div>
  );
}