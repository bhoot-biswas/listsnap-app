import { describe, expect, it, vi } from "vitest";
import type { WooApi } from "./http";
import { ITEM_META_KEY, syncVariations, type ColorAttribute } from "./variations";

const attribute = { option: (color: string) => ({ id: 1, option: color }) } as unknown as ColorAttribute;
const colour = (itemId: string, stockQty: number | null) => ({
  itemId,
  color: itemId,
  regularPrice: 500,
  stockQty,
  mediaId: null,
});

/** A product that already has a Red variation, answering every batch without errors. */
function store() {
  const get = vi.fn(async () => [{ id: 11, meta_data: [{ key: ITEM_META_KEY, value: "red" }] }]);
  const post = vi.fn<(path: string, body: { create: object[]; update: object[] }) => Promise<object>>(async () => ({}));
  return { api: { get, post } as unknown as WooApi, post };
}

describe("syncVariations stock", () => {
  const images = { ids: new Map(), src: async () => null };

  it("leaves an existing colour's count alone when the seller didn't change stock", async () => {
    const { api, post } = store();
    await syncVariations(api, 7, [colour("red", 4), colour("blue", 2)], attribute, { ...images, keepStock: true });
    const body = post.mock.calls[0]![1];
    expect(body.update[0]).not.toHaveProperty("stock_quantity");
    expect(body.update[0]).not.toHaveProperty("manage_stock");
    // a new colour still gets its stock
    expect(body.create[0]).toMatchObject({ manage_stock: true, stock_quantity: 2 });
  });

  it("sends the seller's changed count", async () => {
    const { api, post } = store();
    await syncVariations(api, 7, [colour("red", 4)], attribute, { ...images, keepStock: false });
    expect(post.mock.calls[0]![1].update[0]).toMatchObject({ manage_stock: true, stock_quantity: 4 });
  });
});
