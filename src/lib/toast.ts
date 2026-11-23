export type ToastTone = "success" | "error";

// Show a small message in the corner. Works from any client component; the Toaster in the admin shell displays it.
export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, tone } }));
}
