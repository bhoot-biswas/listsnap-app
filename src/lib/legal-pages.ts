/** The public policy pages, in the order they're linked from the footer, Help and each other. */
export const LEGAL_PAGES = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "deletion", href: "/data-deletion" },
] as const;
export type LegalKey = (typeof LEGAL_PAGES)[number]["key"];
