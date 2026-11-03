import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("legal"))("privacy.title") };
}

const SECTIONS = ["collect", "use", "share", "keep", "delete", "security", "changes"] as const;

export default function PrivacyPage() {
  return <LegalPage page="privacy" sections={SECTIONS} />;
}
