"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export default function PropertyActionLink({ href, children, className }: {
  href: string;
  children: ReactNode;
  className: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Link
      href={href}
      aria-busy={loading}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        setLoading(true);
      }}
      className={`${className} inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 aria-busy:cursor-wait aria-busy:bg-primary aria-busy:text-primary-foreground aria-busy:ring-primary`}
    >
      {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {loading ? "Opening…" : children}
    </Link>
  );
}
