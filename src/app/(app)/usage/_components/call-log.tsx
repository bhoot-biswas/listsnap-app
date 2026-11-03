import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { UsageCall } from "@/server/db/scope";
import { cn } from "@/lib/utils";

/** The newest AI calls across the shop: real model names, timings and cost, like a job's Under the hood. */
export async function CallLog({ calls, money }: { calls: UsageCall[]; money: (n: number) => string }) {
  const t = await getTranslations("usage.log");
  const tCommon = await getTranslations("common");
  const tStep = await getTranslations("usage.steps.name");
  const format = await getFormatter();
  return (
    <section aria-labelledby="log" className="space-y-3 rounded-xl border bg-card p-4 md:p-5">
      <div>
        <h2 id="log" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="divide-y font-mono text-xs">
          {calls.map((c) => {
            const line = (
              <>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
                    {format.dateTime(c.created_at, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 truncate">{c.model.replace(" (mock)", "")}</span>
                  {c.mode === "mock" && (
                    <Badge variant="secondary" className="font-sans">
                      {tCommon("mock")}
                    </Badge>
                  )}
                  <span className="ml-auto shrink-0 tabular-nums">
                    {t("seconds", { s: format.number(c.ms / 1000, { maximumFractionDigits: 1 }) })}
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums max-sm:hidden">
                    {money(Number(c.cost_usd))}
                  </span>
                  <span className={cn("shrink-0", c.ok ? "text-success" : "text-destructive")}>
                    <span aria-hidden="true">{c.ok ? "✓" : "✕"}</span>
                    <span className="sr-only">{t(c.ok ? "ok" : "failed")}</span>
                  </span>
                </div>
                <p className="truncate text-muted-foreground">
                  {tStep.has(c.step) ? tStep(c.step) : c.step} → {c.summary}
                </p>
              </>
            );
            return (
              <li key={c.id}>
                {c.job_id ? (
                  <Link href={`/job/${c.job_id}`} className="-mx-2 block rounded-md px-2 py-2 hover:bg-muted/60">
                    {line}
                  </Link>
                ) : (
                  <div className="py-2">{line}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
