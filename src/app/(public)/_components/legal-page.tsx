import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CONTACT_EMAIL } from "@/lib/contact";
import { PublicHeader } from "./public-header";

/** When the texts were last changed; shown at the top, as each policy promises. */
const UPDATED = new Date(Date.UTC(2026, 10, 3));
export const LEGAL_PAGES = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "deletion", href: "/data-deletion" },
] as const;
type LegalKey = (typeof LEGAL_PAGES)[number]["key"];

/**
 * Privacy, terms and data deletion: plain text from the messages files, in the seller's
 * language, readable signed out (Meta's and Shopify's app review link to them).
 */
export async function LegalPage({ page, sections }: { page: LegalKey; sections: readonly string[] }) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6">
      <PublicHeader />
      <article className="space-y-8 py-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t(`${page}.title`)}</h1>
          <p className="text-sm text-muted-foreground">
            {t("updated", { date: format.dateTime(UPDATED, { dateStyle: "long", timeZone: "UTC" }) })}
          </p>
          <p className="text-lg text-muted-foreground">{t(`${page}.intro`)}</p>
        </header>
        {sections.map((s) => (
          <section key={s} aria-labelledby={`legal-${s}`} className="space-y-3">
            <h2 id={`legal-${s}`} className="text-xl font-semibold">
              {t(`${page}.sections.${s}.h`)}
            </h2>
            {t(`${page}.sections.${s}.p`, { email: CONTACT_EMAIL })
              .split("\n\n")
              .map((para, i) => (
                <p key={i} className="leading-relaxed">
                  {para}
                </p>
              ))}
          </section>
        ))}
        <p className="text-sm">
          {t.rich("contactLine", {
            email: CONTACT_EMAIL,
            link: (chunks) => (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <nav aria-label={t("nav.privacy")} className="flex flex-wrap gap-x-5 border-t pt-4 text-sm">
          {LEGAL_PAGES.filter((p) => p.key !== page).map((p) => (
            <Link key={p.key} href={p.href} className="inline-flex min-h-11 items-center text-primary hover:underline">
              {t(`nav.${p.key}`)}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
