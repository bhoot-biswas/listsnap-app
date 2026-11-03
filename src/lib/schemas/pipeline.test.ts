import { describe, expect, it } from "vitest";
import { checkNotesFor, writtenStatus } from "./pipeline";

describe("writtenStatus", () => {
  it("is Ready only when Spark is confident and left nothing to check", () => {
    expect(writtenStatus({ confidence: 0.82, check_notes: [] })).toBe("ready");
  });

  it("needs review when there is something to check, however confident", () => {
    expect(writtenStatus({ confidence: 0.95, check_notes: ["Confirm genuine or faux leather"] })).toBe("needs_review");
  });

  it("needs review when Spark is unsure", () => {
    expect(writtenStatus({ confidence: 0.66, check_notes: [] })).toBe("needs_review");
  });
});

describe("checkNotesFor", () => {
  const en = ["Check the fabric", "Check the price: we heard ৳1200 in your voice note."];
  const bn = { check_notes: ["কাপড়টা দেখে নিন", "দামটা দেখে নিন: ভয়েস নোটে আমরা ৳1200 শুনেছি।"] };

  it("shows a Bangla reader the Bangla notes", () => {
    expect(checkNotesFor("bn", en, bn)).toEqual(bn.check_notes);
    expect(checkNotesFor("en", en, bn)).toEqual(en);
  });

  it("falls back to English when the Bangla notes are missing or don't line up", () => {
    expect(checkNotesFor("bn", en, {})).toEqual(en);
    expect(checkNotesFor("bn", en, null)).toEqual(en);
    expect(checkNotesFor("bn", en, { check_notes: ["একটাই"] })).toEqual(en);
    expect(checkNotesFor("bn", null, bn)).toEqual([]);
  });
});
