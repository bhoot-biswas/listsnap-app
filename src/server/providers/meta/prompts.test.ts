import { describe, expect, it } from "vitest";
import { saidText } from "./prompts";

const said = { price_bdt: 1500, sizes: [], colors: ["maroon"], stock: null, material: null, notes: [] };

describe("saidText", () => {
  it("is empty without a voice note", () => {
    expect(saidText(null)).toBe("");
  });

  it("carries the seller's facts as data", () => {
    expect(saidText(said)).toContain(`The seller said: ${JSON.stringify(said)}`);
  });

  // Review's check notes are the only place a seller would see that the note or photo is wrong
  it("asks for a check note only when the note can't be this photo", () => {
    expect(saidText(said)).toContain("check_notes entry start 'You said'");
    expect(saidText(said)).toContain("anything a photo can't show");
  });
});
