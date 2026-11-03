"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `N` opens New listing from anywhere, but only as a plain key press on the page: not
 * held down, not while typing, and not while a menu, dialog or list box has the keys
 * (a menu uses letters to jump to its items, and N there would leave the page).
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (e.key !== "n" && e.key !== "N") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (target?.closest("[role='menu'], [role='listbox'], [role='dialog'], dialog")) return;
      if (document.querySelector("dialog[open], [role='dialog'][data-open], [role='menu'][data-open]")) return;
      e.preventDefault();
      router.push("/snap");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
