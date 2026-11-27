import { HelpCircle } from "lucide-react";

// Small "?" next to a label. Hover, focus or tap shows the text. Pure CSS, no client JS.
export default function InfoHint({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <button type="button" aria-label={text} title={text} className="rounded-full text-muted-foreground hover:text-foreground focus:text-foreground focus:outline-none">
        <HelpCircle className="h-4 w-4" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-60 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-left text-xs font-normal leading-snug text-ink-foreground shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  );
}
