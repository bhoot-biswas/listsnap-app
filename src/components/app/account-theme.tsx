"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * The theme saved to the account, on a browser that hasn't chosen one yet (a new phone,
 * a cleared browser). A browser's own choice wins: it is the newer one on that device.
 */
export function AccountTheme({ theme }: { theme: string | null }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!theme) return;
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem("theme");
    } catch {}
    if (!chosen) setTheme(theme);
  }, [theme, setTheme]);
  return null;
}
