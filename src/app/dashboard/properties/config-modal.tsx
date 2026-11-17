"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Shared shell for the configuration popups. It is rendered outside the property <form> (portal),
// so pressing Enter inside it can never submit the property form. Changes are made on a draft copy
// by the content, and only applied to the form when "Save configuration" is pressed.
export default function ConfigModal({ title, subtitle, onClose, onSave, saveLabel = "Save configuration", children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-3 border-t border-cream p-4">
          <button type="button" onClick={onClose} className="rounded-full bg-cream px-6 py-3 hover:bg-cream/70">Cancel</button>
          <button type="button" onClick={onSave} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink">{saveLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
