import { describe, expect, it } from "vitest";
import { listingPrice } from "@/lib/schemas/review";
import { keepsStoreStock, stockKey, suggestedPrice } from "./store-step";

describe("suggestedPrice", () => {
  it("takes the middle of the range, rounded the shop's way", () => {
    expect(suggestedPrice({ low: 2800, high: 6500 }, 10)).toBe(4650);
    expect(suggestedPrice({ low: 180, high: 350 }, 50)).toBe(250);
    expect(suggestedPrice({ low: 650, high: 1200 }, 0)).toBe(925);
  });

  it("gives no price for a range that makes no sense", () => {
    expect(suggestedPrice({ low: 0, high: 0 }, 10)).toBeNull();
    expect(suggestedPrice({ low: 900, high: 400 }, 10)).toBeNull();
  });
});

describe("listingPrice", () => {
  it("uses the seller's price when there is one, else the suggestion Review shows", () => {
    expect(listingPrice(1750, { low: 1200, high: 2200 }, 50)).toBe(1750);
    expect(listingPrice(null, { low: 1200, high: 2200 }, 50)).toBe(1700);
  });

  it("has no price without a sensible range", () => {
    expect(listingPrice(null, undefined, 50)).toBeNull();
    expect(listingPrice(null, { low: 0, high: 0 }, 50)).toBeNull();
  });
});

describe("keepsStoreStock", () => {
  const three = stockKey({ stockQty: 3, variants: null });

  it("sends stock to a new product", () => {
    expect(keepsStoreStock(null, undefined, three)).toBe(false);
    expect(keepsStoreStock(null, three, three)).toBe(false);
  });

  it("leaves the store's count alone on an update when the seller didn't change stock", () => {
    expect(keepsStoreStock("7", three, three)).toBe(true);
    expect(keepsStoreStock("7", three, stockKey({ stockQty: 3, variants: null }))).toBe(true);
  });

  it("sends stock again once the seller changes it, a colour's included", () => {
    expect(keepsStoreStock("7", three, stockKey({ stockQty: 5, variants: null }))).toBe(false);
    const red = (qty: number | null) => ({
      itemId: "i1",
      color: "Red",
      regularPrice: 100,
      stockQty: qty,
      mediaId: null,
    });
    expect(
      keepsStoreStock(
        "7",
        stockKey({ stockQty: 3, variants: [red(2)] }),
        stockKey({ stockQty: 3, variants: [red(4)] }),
      ),
    ).toBe(false);
  });

  it("leaves stock alone for a product saved before stock was kept", () => {
    expect(keepsStoreStock("7", undefined, three)).toBe(true);
  });
});
