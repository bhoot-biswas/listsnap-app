import "server-only";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { lookOf, type Look } from "@/lib/schemas/looks";
import { ReelVariables, type ReelLang } from "@/lib/schemas/reels";

/**
 * What goes into a reel, chosen only from the listing's saved photos and text. Pure, so
 * the choices are tested without rendering anything.
 */

export interface ReelPhoto {
  id: string;
  kind: string;
  selected: boolean;
}

export interface ReelPhotos {
  hero: string;
  look1: string;
  look2: string;
  product: string;
  /** The look each middle photo shows, for its label; null for any other photo. */
  labels: [Look | null, Look | null];
  /** True when any photo used is an AI scene, so the reel carries the same label. */
  aiScene: boolean;
  /** Whether each middle photo was already shown, because the listing has few photos. */
  repeats: [boolean, boolean];
}

const AI_SCENES = (kind: string) => kind === "lifestyle" || lookOf(kind) !== null;

/**
 * Hero, two middle photos and the end card. The seller's ticks decide what may appear;
 * the banner is left out because a 2:1 picture loses its product when cropped to 9:16.
 * A listing with fewer photos repeats one rather than failing.
 */
export function pickPhotos(media: ReelPhoto[], mainId: string): ReelPhotos {
  const usable = media.filter((m) => m.selected && m.kind !== "banner");
  const of = (kind: string) => usable.find((m) => m.kind === kind)?.id;
  const looks = usable.filter((m) => lookOf(m.kind));

  const product = of("studio") ?? mainId;
  const hero = of("lifestyle") ?? looks[0]?.id ?? product;
  const rest = [...looks, ...usable.filter((m) => !lookOf(m.kind))]
    .map((m) => m.id)
    .filter((id) => id !== hero && id !== product);
  const look1 = rest[0] ?? hero;
  const look2 = rest[1] ?? product;

  const kindOf = (id: string) => usable.find((m) => m.id === id)?.kind ?? "main";
  const used = [hero, look1, look2, product];
  return {
    hero,
    look1,
    look2,
    product,
    labels: [lookOf(kindOf(look1)), lookOf(kindOf(look2))],
    aiScene: used.some((id) => AI_SCENES(kindOf(id))),
    repeats: [look1 === hero, look2 === hero || look2 === look1],
  };
}

/** "৳4,000" in English and "৳৪,০০০" in Bangla, the way the seller writes prices. */
export function reelPrice(bdt: number, lang: ReelLang): string {
  return `৳${new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(bdt)}`;
}

const FACT_MAX = 34;

/**
 * Up to three of the listing's saved attributes, as lines for the reel. One that won't fit
 * on a line is skipped, not cut: half a fact tells a buyer nothing.
 */
export function reelFacts(attributes: { name: string; value: string }[] = []): [string, string, string] {
  const [a = "", b = "", c = ""] = attributes
    .map((f) => ({ name: f.name.trim(), value: f.value.trim() }))
    .filter((f) => f.name && f.value)
    .map((f) => `${f.name}: ${f.value}`)
    .filter((line) => line.length <= FACT_MAX);
  return [a, b, c];
}

const DEFAULT_COLORS = { ground: "#EFEEEA", accent: "#161616" };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Brand-kit colours have no roles, so they are given one by lightness: the lightest
 * becomes the ground and the darkest the accent (words and the button), but only when
 * they're light or dark enough to read on each other. Anything else keeps the template's own colours.
 */
export function reelColors(kit: string[]): typeof DEFAULT_COLORS {
  const sorted = [...kit].sort((a, b) => luminance(b) - luminance(a));
  const light = sorted[0];
  const dark = sorted.at(-1);
  return {
    ground: light && luminance(light) > 0.7 ? light : DEFAULT_COLORS.ground,
    accent: dark && luminance(dark) < 0.3 ? dark : DEFAULT_COLORS.accent,
  };
}

const WORDS = { en, bn };

export function reelVariables(input: {
  lang: ReelLang;
  title: string;
  priceBdt: number;
  shop: string;
  labels: [Look | null, Look | null];
  attributes?: { name: string; value: string }[];
  repeats?: [boolean, boolean];
  kit: string[];
}): ReelVariables {
  const words = WORDS[input.lang];
  const label = (l: Look | null) => (l ? words.review.looks.names[l] : "");
  const [fact1, fact2, fact3] = reelFacts(input.attributes);
  return ReelVariables.parse({
    // the end card and the opening both show the title; keep it within the box at any length
    title: input.title.length > 80 ? `${input.title.slice(0, 79).trimEnd()}…` : input.title,
    price: reelPrice(input.priceBdt, input.lang),
    shop: input.shop.slice(0, 40),
    cta: words.review.reels.cta,
    look1Label: label(input.labels[0]),
    look2Label: label(input.labels[1]),
    fact1,
    fact2,
    fact3,
    ...reelColors(input.kit),
    look1Repeat: input.repeats?.[0] ? "yes" : "no",
    look2Repeat: input.repeats?.[1] ? "yes" : "no",
    lang: input.lang,
  });
}
