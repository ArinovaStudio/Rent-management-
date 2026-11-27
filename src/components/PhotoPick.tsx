"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

// Photo picker with live preview. Still a real <input type="file" name="photo"> so FormData picks it up.
// variant "tile" = big square drop tile (add popup), "round" = small round picker (users form).
export default function PhotoPick({ name = "photo", variant = "round", current }: { name?: string; variant?: "tile" | "round"; current?: string | null }) {
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const clear = () => { if (input.current) input.current.value = ""; setUrl(""); };
  const file = (
    <input
      ref={input} type="file" name={name} accept="image/jpeg,image/png,image/webp" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; setUrl(f ? URL.createObjectURL(f) : ""); }}
    />
  );
  // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise
  const preview = url && <img src={url} alt="Selected photo" className="absolute inset-0 h-full w-full object-cover" />;

  if (variant === "tile") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Photo (optional)</span>
        <div className="relative aspect-square w-full">
          <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl bg-cream text-foreground/80 hover:bg-cream/70">
            {preview}
            {!url && current
              // eslint-disable-next-line @next/next/no-img-element -- already-saved photo shown as the starting preview
              ? <img src={`/api/uploads/${current}`} alt="Current photo" className="absolute inset-0 h-full w-full object-cover" />
              : null}
            {!url && !current && <><ImagePlus className="h-7 w-7" /><span className="text-xs">Upload photo</span></>}
            {!url && current && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs">Change photo</span>}
            {file}
          </label>
          {url && (
            <button type="button" aria-label="Remove photo" onClick={clear} className="absolute right-2 top-2 rounded-full bg-background p-1.5 shadow hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-primary/30 bg-cream/60 text-primary hover:border-primary">
        {preview || <Camera className="h-6 w-6" />}
        {file}
      </label>
      <div className="min-w-0 text-sm">
        <p className="font-medium">Photo (optional)</p>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB</p>
        {url && <button type="button" className="mt-1 flex items-center gap-1 text-xs text-destructive" onClick={clear}><X className="h-3 w-3" />Remove</button>}
      </div>
    </div>
  );
}