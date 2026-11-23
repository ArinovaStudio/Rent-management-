"use client";
import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

// router.refresh() inside a transition: the screen the person is using stays interactive while the server
// re-renders, instead of freezing until the new data arrives.
export function useSoftRefresh() {
  const router = useRouter();
  return useCallback(() => startTransition(() => router.refresh()), [router]);
}
