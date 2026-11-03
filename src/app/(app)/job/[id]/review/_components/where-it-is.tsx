import { useTranslations } from "next-intl";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { STORE_NAMES, type StoreKind } from "@/lib/stores";
import { cn } from "@/lib/utils";

/** Everywhere a listing already is, with a link where there is one. */
export interface WhereItIs {
  stores: { kind: StoreKind; url: string | null; behind: boolean }[];
  /** In the Facebook catalog; behind when changed since it was saved there. */
  catalog: { behind: boolean } | null;
  facebook: string | null;
  instagram: string | null;
  /** Marked posted on Marketplace; the seller's own link, when they gave one. */
  marketplace: { url: string | null } | null;
}

/**
 * One line near the top of Review, so "is this in my store, on my Page?" is answered
 * without opening Extras or the Done page. Nothing is drawn until the listing is somewhere.
 */
export function WhereItIsStrip({ where }: { where: WhereItIs }) {
  const t = useTranslations("review.whereItIs");
  const chips: { key: string; label: string; url: string | null; behind?: boolean }[] = [
    ...where.stores.map((s) => ({
      key: s.kind,
      label: t("store", { store: STORE_NAMES[s.kind] }),
      url: s.url,
      behind: s.behind,
    })),
    ...(where.catalog ? [{ key: "catalog", label: t("catalog"), url: null, behind: where.catalog.behind }] : []),
    ...(where.facebook ? [{ key: "facebook", label: t("facebook"), url: where.facebook }] : []),
    ...(where.instagram ? [{ key: "instagram", label: t("instagram"), url: where.instagram }] : []),
    ...(where.marketplace ? [{ key: "marketplace", label: t("marketplace"), url: where.marketplace.url }] : []),
  ];
  if (!chips.length) return null;
  return (
    <section aria-labelledby="where-it-is" className="flex flex-wrap items-center gap-2">
      <h2 id="where-it-is" className="text-sm font-medium text-muted-foreground">
        {t("title")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const body = (
            <>
              {c.label}
              {c.behind && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  {t("behind")}
                </span>
              )}
              {c.url && <ExternalLink className="size-3.5 opacity-70" aria-hidden="true" />}
            </>
          );
          const chip = cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm max-sm:min-h-11",
            c.behind && "border-warning/50",
          );
          return (
            <li key={c.key}>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer" className={cn(chip, "hover:bg-muted")}>
                  {body}
                  <span className="sr-only">{t("opens")}</span>
                </a>
              ) : (
                <span className={chip}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
