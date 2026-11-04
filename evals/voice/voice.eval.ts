import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ListingText } from "@/lib/schemas/pipeline";
import type { SellerFacts } from "@/lib/schemas/voice-note";
import { SPARK_EFFORT, photoDataUrl, sparkJson } from "@/server/providers/meta/spark";
import { saidText, writeSystem } from "@/server/providers/meta/prompts";

/**
 * Does the write step notice a voice note that can't be this photo, without nagging about
 * notes that fit? Each case goes to live Muse Spark with the app's own prompt, three
 * times, because one lucky answer proves little. Run with `pnpm eval:voice`.
 */

const facts = (f: Partial<SellerFacts>): SellerFacts => ({
  price_bdt: null,
  sizes: [],
  colors: [],
  stock: null,
  material: null,
  notes: [],
  ...f,
});

const CLASHES: [string, string, SellerFacts][] = [
  [
    "a three-piece for a kantha",
    "kantha.jpg",
    facts({
      colors: ["maroon"],
      material: "georgette",
      notes: ["Three-piece set"],
      sizes: ["M", "L"],
      price_bdt: 1500,
    }),
  ],
  ["a blue saree for a red one", "saree.jpg", facts({ colors: ["sky blue"], price_bdt: 4000 })],
  [
    "a wallet for a tray",
    "tray.jpg",
    facts({ notes: ["This is a leather wallet, good for gifts"], material: "leather" }),
  ],
  ["a kurti for bangles", "bangles.jpg", facts({ notes: ["Cotton kurti for daily wear"], sizes: ["M", "L"] })],
];

const FITS: [string, string, SellerFacts][] = [
  ["price and stock only", "tray.jpg", facts({ price_bdt: 1200, stock: 5 })],
  ["a close colour", "saree.jpg", facts({ colors: ["maroon"], price_bdt: 4500 })],
  [
    "cream for off-white",
    "kantha.jpg",
    facts({ colors: ["cream"], material: "cotton", notes: ["Handmade in Jashore"] }),
  ],
  ["fabric and sizes", "kurti.jpg", facts({ sizes: ["M", "L", "XL"], material: "cotton", notes: ["Wash gently"] })],
  ["what's included", "saree.jpg", facts({ material: "silk", notes: ["Blouse piece included"], stock: 3 })],
  ["a maker's story", "tray.jpg", facts({ material: "wood", notes: ["Hand painted by my uncle in Dhaka"] })],
  ["a set size", "bangles.jpg", facts({ notes: ["Sold as a set of six"], price_bdt: 320 })],
];

const RUNS = 3;
const report: string[] = [];

// the notes themselves matter as much as the count, and a passing test's logs are hidden
afterAll(() => {
  const dir = path.join(process.cwd(), ".data/evals");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "voice.txt"), `${report.join("\n")}\n`);
});

async function flagged(file: string, said: SellerFacts): Promise<{ yes: boolean; note: string }> {
  const photo = readFileSync(path.join(process.cwd(), "public/samples", file));
  const started = performance.now();
  const r = await sparkJson({
    name: "Listing",
    effort: SPARK_EFFORT.write,
    schema: ListingText,
    system: writeSystem({ tone: "friendly", note: null }),
    userText: `Write the listing for the product in this photo.${saidText(said)}`,
    imageUrl: await photoDataUrl(photo),
  });
  const note = r.data.check_notes[0] ?? "";
  const seconds = Math.round((performance.now() - started) / 1000);
  return { yes: /^you said/i.test(note), note: `(${seconds} s) ${note}` };
}

const count = async (file: string, said: SellerFacts) => {
  const runs: { yes: boolean; note: string }[] = [];
  // one at a time: three at once for the same case tripped the API's limit
  for (let i = 0; i < RUNS; i++)
    // a slow answer gets one more go, as the step runner gives it in the app
    runs.push(await flagged(file, said).catch(() => flagged(file, said)));
  return { yes: runs.filter((r) => r.yes).length, notes: runs.map((r) => r.note) };
};

describe("a voice note that can't be this photo", () => {
  it.each(CLASHES)("flags %s", async (name, file, said) => {
    const r = await count(file, said);
    report.push(`clash, ${name}: ${r.yes}/${RUNS}\n  ${r.notes.join("\n  ")}`);
    expect(r.yes).toBe(RUNS);
  });
});

describe("a voice note that fits", () => {
  it.each(FITS)("doesn't flag %s", async (name, file, said) => {
    const r = await count(file, said);
    report.push(`fits, ${name}: ${r.yes}/${RUNS}\n  ${r.notes.join("\n  ")}`);
    expect(r.yes).toBe(0);
  });
});
