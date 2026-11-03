"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copies a chat reply or caption: sellers paste these into WhatsApp and Facebook all day.
 * The tick says it worked, for a moment; a browser that refuses the clipboard says so.
 */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("chat.copy");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await navigator.clipboard?.writeText(text).then(
      () => true,
      () => false,
    );
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  };
  const label = state === "copied" ? t("done") : state === "failed" ? t("failed") : t("label");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-11 gap-1.5 px-2 text-xs text-muted-foreground md:h-8", className)}
      onClick={() => void copy()}
    >
      {state === "copied" ? (
        <Check className="size-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">{label}</span>
    </Button>
  );
}
