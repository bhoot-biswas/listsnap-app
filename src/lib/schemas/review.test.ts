import { describe, expect, it } from "vitest";
import { ListingEdit } from "./review";

const text = { title: "Red saree", short_description: "", description: "", attributes: [], tags: [] };
const edit = {
  en: { ...text, category: "" },
  bn: text,
  priceBdt: null,
  stockQty: null,
  selectedMediaIds: [],
  variants: null,
};

describe("ListingEdit", () => {
  it("takes a listing with both titles and empty descriptions", () => {
    expect(ListingEdit.safeParse(edit).success).toBe(true);
  });

  // a listing saved without its title can't be opened on Review again
  it.each(["", "   "])("refuses the English title %j", (title) => {
    expect(ListingEdit.safeParse({ ...edit, en: { ...edit.en, title } }).success).toBe(false);
  });

  it.each(["", "   "])("refuses the Bangla title %j", (title) => {
    expect(ListingEdit.safeParse({ ...edit, bn: { ...text, title } }).success).toBe(false);
  });

  it("still takes a listing with no Bangla version", () => {
    expect(ListingEdit.safeParse({ ...edit, bn: null }).success).toBe(true);
  });
});
