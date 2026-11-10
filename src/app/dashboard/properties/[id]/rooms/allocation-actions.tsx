
"use client";

import { useRouter } from "next/navigation";

export default function AllocationActions({ allocationId, residentUrl, }: {
  allocationId: string;
  residentUrl: string;
}) {
  const router = useRouter();

  async function checkout() {
    if (
      !window.confirm(
        "Check this resident out? Their bed will become available."
      )
    ) {
      return;
    }

    const send = () => fetch(`/api/allocations/${allocationId}`, { method: "PATCH",});

    let res = await send();

    if ( res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST",})).ok) {
      res = await send();
    }

    if (res.ok) {
      router.refresh();
    } else {
      alert(
        (await res.json().catch(() => ({}))).error ??
          "Could not check out resident."
      );
    }
  }

  return (
    <div className="resident-actions">
      <button type="button" className="button secondary"
        onClick={() =>
          navigator.clipboard.writeText(
            `${window.location.origin}${residentUrl}`
          )
        }
      >
        Copy link
      </button>

      <button type="button" className="button secondary" onClick={checkout}>
        Check out
      </button>
    </div>
  );
}
