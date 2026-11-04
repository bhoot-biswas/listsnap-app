import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clapperboard, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/app/top-bar";
import { ButtonLink } from "@/components/app/button-link";
import { ExportMenu } from "@/components/app/export-menu";
import { buttonVariants } from "@/components/ui/button";
import { requireWorkspace } from "@/server/auth/session";
import { forWorkspace } from "@/server/db/scope";
import { loadJobState } from "@/server/pipeline/job-state";
import type { StoreResult } from "@/server/pipeline/store-step";
import { STORE_KINDS, STORE_NAMES, storeStep, type StoreKind } from "@/lib/stores";
import { makingSeconds } from "@/lib/job-time";
import { cn } from "@/lib/utils";
import { nextListing, numberRepeats, REVIEWABLE } from "@/lib/review-next";
import { requestLocale } from "@/server/step-text";
import { connectedStores } from "@/server/stores/targets";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("done"))("title") };
}

/** Time from upload to the last model call; store saves don't count. Null for jobs nothing was timed on. */
/** Where each store saved the listing; an older WooCommerce result has no productRef but has the link. */
async function savedIn(ws: ReturnType<typeof forWorkspace>, jobId: string, listingId: string) {
  const results = await Promise.all(
    STORE_KINDS.map(async (kind) => ({ kind, r: await ws.stepResult<StoreResult>(jobId, storeStep(kind), listingId) })),
  );
  return results.flatMap(({ kind, r }) => (r?.editUrl ? [{ kind, editUrl: r.editUrl }] : []));
}

/** S8 Done: what was saved to the store, and where to go next (a reel or post is made on Review). */
export default async function DonePage({ params }: PageProps<"/job/[id]/done">) {
  const viewer = await requireWorkspace();
  const { id } = await params;
  const state = await loadJobState(viewer.workspace, id, await requestLocale());
  if (!state) notFound();
  const ws = forWorkspace(viewer.workspace.id);
  // a demo store's admin isn't the seller's to open, so its drafts get no store link
  const demoStores = new Set((await connectedStores(viewer.workspace)).filter((s) => s.demo).map((s) => s.kind));
  const saved = await Promise.all(
    state.listings
      .filter((l) => l.status === "in_store" || l.status === "posted")
      .map(async (l) => ({
        listing: l,
        stores: (await savedIn(ws, id, l.id)).filter((s) => !demoStores.has(s.kind)),
      })),
  );
  const several = new Set(saved.flatMap((s) => s.stores.map((x) => x.kind))).size > 1;
  if (!saved.length) redirect(`/job/${id}`);

  const t = await getTranslations("done");
  const tReview = await getTranslations("review");
  const seconds = makingSeconds(state.createdAt, state.calls);
  // one photo, several products: lead to the next one not saved yet, not back to Snap
  const next = nextListing(
    numberRepeats(
      state.listings.filter((l) => REVIEWABLE.has(l.status)),
      (title, n) => tReview("titleN", { title, n }),
    ),
    null,
  );
  const unsaved = state.listings.filter((l) => l.status === "needs_review" || l.status === "ready").length;
  const linkClass = cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full");

  return (
    <>
      <TopBar title={t("title")} />
      <div className="mx-auto w-full max-w-md px-4 py-10 md:px-6">
        <section aria-labelledby="done-title" className="space-y-6 rounded-xl border bg-card p-6 text-center">
          <CircleCheck className="mx-auto size-12 text-success" aria-hidden="true" />
          <div className="space-y-2">
            <h2 id="done-title" className="text-2xl font-semibold">
              {t("heading", { count: saved.length })}
            </h2>
            {saved.length === 1 && (
              <p className="text-muted-foreground">{t("body", { title: saved[0]!.listing.title ?? "" })}</p>
            )}
          </div>

          {demoStores.size > 0 && <p className="text-sm text-muted-foreground">{t("demoStore")}</p>}

          {saved.length > 1 && (
            <ul className="divide-y rounded-lg border text-left">
              {saved.map(({ listing, stores }) => (
                <li key={listing.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <Link
                    href={`/job/${id}/review?l=${listing.id}`}
                    className="inline-flex min-h-11 min-w-0 items-center text-sm hover:underline"
                  >
                    <span className="truncate">{listing.title}</span>
                  </Link>
                  <span className="flex shrink-0 gap-3">
                    {stores.map((s) => (
                      <a
                        key={s.kind}
                        href={s.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
                      >
                        {several ? STORE_NAMES[s.kind] : t("open")}
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {next && (
            <div className="space-y-2">
              <ButtonLink href={`/job/${id}/review?l=${next.id}`} size="lg" className="w-full">
                <span className="min-w-0 truncate">{t("next", { title: next.title ?? "" })}</span>
                <ArrowRight aria-hidden="true" />
              </ButtonLink>
              <p className="text-sm text-muted-foreground">{t("moreToSave", { count: unsaved })}</p>
            </div>
          )}

          <div className="space-y-3">
            {saved.length === 1 &&
              saved[0]!.stores.map((s) => (
                <a key={s.kind} href={s.editUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {t("openIn", { store: STORE_NAMES[s.kind as StoreKind] })}
                  <ExternalLink aria-hidden="true" />
                </a>
              ))}
            <ExportMenu
              listingIds={saved.map((s) => s.listing.id)}
              hasWebsite={!!viewer.workspace.settings.website}
              label={t("export")}
              size="lg"
              className="w-full"
            />
            {saved.length === 1 && (
              <ButtonLink
                href={`/job/${id}/review?l=${saved[0]!.listing.id}#extras`}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Clapperboard aria-hidden="true" />
                {t("reelOrPost")}
              </ButtonLink>
            )}
            <ButtonLink href="/snap" size="lg" variant={next ? "outline" : "default"} className="w-full">
              {t("snapAnother")}
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="ghost" className="w-full">
              {t("toDashboard")}
            </ButtonLink>
          </div>

          {saved.length > 1 && <p className="text-sm text-muted-foreground">{t("reelOrPostMany")}</p>}
          {seconds !== null && (
            <p className="text-xs text-muted-foreground">
              {t("stats", { seconds, cost: state.costUsd.toFixed(state.costUsd < 0.01 ? 3 : 2) })}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
