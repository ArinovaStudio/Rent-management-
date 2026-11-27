"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function PropertyOpenLink({
  href,
  name,
  className,
  card = false,
}: {
  href: string;
  name: string;
  className?: string;
  card?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Link
      href={href}
      aria-label={card ? `Open ${name}` : undefined}
      aria-busy={loading}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        setLoading(true);
      }}
      className={className}
    >
      {card ? null : <>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Opening…" : "Open"}</>}
      {card && loading && (
        <span className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-ink/30" role="status" aria-live="polite">
          <span className="flex items-center gap-3 rounded-2xl bg-background px-5 py-4 text-sm font-medium shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />Opening {name}…
          </span>
        </span>
      )}
    </Link>
  );
}
