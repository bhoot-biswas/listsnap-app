import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReelVariables } from "@/lib/schemas/reels";
import { pickPhotos, reelColors, reelFacts, reelPrice, reelVariables } from "./inputs";

const photo = (id: string, kind: string, selected = true) => ({ id, kind, selected });

describe("reel inputs", () => {
  it("opens on the lifestyle photo, shows the looks in the middle and ends on the studio photo", () => {
    const p = pickPhotos(
      [
        photo("s", "studio"),
        photo("l", "lifestyle"),
        photo("b", "banner"),
        photo("e", "look_eid"),
        photo("w", "look_boishakh"),
      ],
      "main",
    );
    expect(p).toMatchObject({
      hero: "l",
      look1: "e",
      look2: "w",
      product: "s",
      labels: ["eid", "boishakh"],
      aiScene: true,
      repeats: [false, false],
    });
  });

  it("uses only ticked photos, never the banner, and falls back to the main image", () => {
    const p = pickPhotos([photo("s", "studio", false), photo("b", "banner"), photo("e", "look_eid", false)], "main");
    expect(p).toMatchObject({
      hero: "main",
      look1: "main",
      look2: "main",
      product: "main",
      aiScene: false,
      repeats: [true, true],
    });
    expect(p.labels).toEqual([null, null]);
  });

  it("labels only the photos that are looks", () => {
    const p = pickPhotos([photo("s", "studio"), photo("l", "lifestyle"), photo("e", "look_eid")], "main");
    expect(p).toMatchObject({ hero: "l", look1: "e", look2: "s", product: "s", labels: ["eid", null] });
  });

  it("writes prices the way sellers do in each language", () => {
    expect(reelPrice(4000, "en")).toBe("৳4,000");
    expect(reelPrice(4000, "bn")).toBe("৳৪,০০০");
    expect(reelPrice(125000, "en")).toBe("৳125,000");
  });

  it("turns the first three attributes that fit a line into facts", () => {
    expect(
      reelFacts([
        { name: "Fabric", value: "Cotton" },
        { name: "Design", value: "Central lotus with a wide paisley border" },
        { name: "Size", value: " " },
        { name: "Work", value: "Hand embroidery" },
        { name: "Color", value: "Maroon" },
        { name: "Fit", value: "Regular" },
      ]),
    ).toEqual(["Fabric: Cotton", "Work: Hand embroidery", "Color: Maroon"]);
    expect(reelFacts()).toEqual(["", "", ""]);
  });

  it("gives brand colours a role only when text stays readable on them", () => {
    expect(reelColors(["#7A1F2B", "#D9A441", "#F3E9D2"])).toMatchObject({
      ground: "#F3E9D2",
      accent: "#7A1F2B",
    });
    // a mid-grey is neither light enough for a ground nor dark enough for words and the button
    expect(reelColors(["#808080"])).toEqual({ ground: "#EFEEEA", accent: "#161616" });
    expect(reelColors([])).toEqual({ ground: "#EFEEEA", accent: "#161616" });
  });

  it("fills the template in either language and keeps every value within its limit", () => {
    const en = reelVariables({
      lang: "en",
      title: "x".repeat(200),
      priceBdt: 900,
      shop: "Nakshi Loom",
      labels: ["eid", null],
      attributes: [{ name: "Fabric", value: "Cotton" }],
      kit: [],
    });
    expect(en.title.length).toBeLessThanOrEqual(80);
    expect(en).toMatchObject({
      cta: "Message us to order",
      look1Label: "Eid",
      look2Label: "",
      fact1: "Fabric: Cotton",
      fact2: "",
      look1Repeat: "no",
      lang: "en",
    });
    const bn = reelVariables({
      lang: "bn",
      title: "লাল শাড়ি",
      priceBdt: 900,
      shop: "ডেমো শপ",
      labels: ["boishakh", "eid"],
      kit: [],
    });
    expect(bn).toMatchObject({
      price: "৳৯০০",
      cta: "অর্ডার করতে মেসেজ করুন",
      look1Label: "পহেলা বৈশাখ",
      look2Label: "ঈদ",
    });
  });

  it("matches the variables the showcase template declares, so a strict render never refuses them", () => {
    const html = readFileSync(path.join(process.cwd(), "src/server/reels/templates/showcase/index.html"), "utf8");
    const declared = JSON.parse(/data-composition-variables='([^']*)'/.exec(html)![1]!) as {
      id: string;
      maxLength?: number;
    }[];
    const ids = declared.map((d) => d.id).filter((id) => id !== "guides");
    expect(ids.sort()).toEqual(Object.keys(ReelVariables.shape).sort());
    // the template's own limits match ours, so its Studio shows the same rules
    for (const d of declared) if (d.maxLength) expect(ReelVariables.shape[d.id as "title"].maxLength).toBe(d.maxLength);
  });
});
