"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The Bangla tab of a listing that has no Bangla. Review only shows finished listings, so
 * the Bangla isn't on its way: the shop writes English only, or every attempt failed. The
 * seller can have it written now; Review then opens again with the Bangla in place.
 */
export function BanglaMissing({
  listingId,
  off,
  beforeWrite,
}: {
  listingId: string;
  /** The shop writes listings in English only (Settings). */
  off: boolean;
  /** Saves the seller's pending edits, since the form opens again afterwards. */
  beforeWrite: () => Promise<unknown>;
}) {
  const t = useTranslations("review.banglaMissing");
  const router = useRouter();
  const [state, setState] = useState<{ kind: "idle" | "writing" } | { kind: "failed"; message: string }>({
    kind: "idle",
  });

  async function write() {
    setState({ kind: "writing" });
    await beforeWrite();
    let retry = true;
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`/api/listings/${listingId}/steps/translate${retry ? "?retry=1" : ""}`, {
        method: "POST",
      }).catch(() => null);
      retry = false;
      if (res?.status === 202) {
        await sleep(1500);
        continue;
      }
      const body = (await res?.json().catch(() => null)) as { state?: string; error?: string } | null;
      if (res?.ok && body?.state === "done") return router.refresh();
      return setState({ kind: "failed", message: body?.error ?? t("failed") });
    }
    setState({ kind: "failed", message: t("failed") });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <p className="text-sm">{off ? t("off") : t("notWritten")}</p>
      <Button type="button" variant="outline" className="h-11" disabled={state.kind === "writing"} onClick={write}>
        {state.kind === "writing" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Languages className="size-4" aria-hidden="true" />
        )}
        {state.kind === "writing" ? t("writing") : t("write")}
      </Button>
      {off && (
        <p className="text-xs text-muted-foreground">
          {t("settingsHint")}{" "}
          <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("settingsLink")}
          </Link>
        </p>
      )}
      <p aria-live="polite" className="text-xs text-destructive">
        {state.kind === "failed" ? state.message : ""}
      </p>
    </div>
  );
}
