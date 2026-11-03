import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../_components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("legal"))("deletion.title") };
}

const SECTIONS = ["account", "email", "facebook", "stays"] as const;

export default function DataDeletionPage() {
  return <LegalPage page="deletion" sections={SECTIONS} />;
}
