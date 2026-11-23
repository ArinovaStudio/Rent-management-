"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { ToastTone } from "@/lib/toast";

type Item = { id: number; message: string; tone: ToastTone };

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let n = 0;
    function onToast(e: Event) {
      const { message, tone } = (e as CustomEvent<{ message: string; tone: ToastTone }>).detail;
      const id = ++n;
      setItems((cur) => [...cur, { id, message, tone }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4500);
    }
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${t.tone === "error" ? "bg-destructive text-white" : "bg-ink text-white"}`}>
          {t.tone === "error" ? <X className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
