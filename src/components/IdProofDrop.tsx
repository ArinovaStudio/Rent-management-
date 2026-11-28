"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Plus, RefreshCw, UploadCloud, X } from "lucide-react";

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// ID proof drop zone. Once a file is chosen, its preview fills the box (image, or first page of a PDF).
// The parent owns the file and its validation: `onPick` gets the raw FileList, `onClear` removes the file.
export default function IdProofDrop({ file, accept, maxMb, onPick, onClear }: {
  file: File | null;
  accept: string;
  maxMb: number;
  onPick: (list: FileList | null) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (list: FileList | null) => { onPick(list); if (input.current) input.current.value = ""; };
  const isPdf = file?.type === "application/pdf";

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
      className={`relative isolate overflow-hidden [clip-path:inset(0_round_1rem)] rounded-2xl border-2 border-dashed border-cream bg-cream/40 text-center ${file ? "h-64" : "p-5"}`}
    >
      {file && url ? (
        <>
          {isPdf ? (
            <iframe src={`${url}#toolbar=0&navpanes=0`} title="ID proof preview" className="pointer-events-none absolute inset-0 h-full w-full bg-background" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise
            // <img src={url} alt="ID proof preview" className="absolute inset-0 h-full w-full bg-background object-contain" />
            <img src={url} alt="ID proof preview" className="absolute inset-0 h-full w-full rounded-[inherit] object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-background/90 px-4 py-2.5 text-sm backdrop-blur">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-left">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{size(file.size)}</span>
            <button type="button" onClick={() => input.current?.click()} className="flex shrink-0 items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs hover:bg-cream/70"><RefreshCw className="h-3.5 w-3.5" />Replace</button>
          </div>
          <button type="button" aria-label="Remove file" onClick={onClear} className="absolute right-2 top-2 rounded-full bg-background p-1.5 shadow hover:text-destructive"><X className="h-4 w-4" /></button>
        </>
      ) : (
        <>
          <UploadCloud className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 text-sm font-medium">Drag the file here or</p>
          <button type="button" onClick={() => input.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-ink"><Plus className="h-4 w-4" />Choose file</button>
          <p className="mt-2 text-xs text-muted-foreground">PDF, JPG, PNG, WebP · max {maxMb} MB · one file only</p>
        </>
      )}
      <input ref={input} type="file" accept={accept} className="sr-only" onChange={(e) => pick(e.target.files)} />
    </div>
  );
}
