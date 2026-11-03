import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("legal"))("terms.title") };
}

const SECTIONS = ["service", "account", "content", "ai", "rules", "others", "liability", "ending"] as const;

export default function TermsPage() {
  return <LegalPage page="terms" sections={SECTIONS} />;
}
