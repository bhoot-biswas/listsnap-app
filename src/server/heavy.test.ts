import { describe, expect, it } from "vitest";
import { heavy } from "./heavy";

describe("heavy work", () => {
  it("runs two at a time, the rest in the order they came, and frees a slot after a failure", async () => {
    let running = 0;
    let most = 0;
    const order: number[] = [];
    const job = (n: number, fail = false) =>
      heavy(async () => {
        running++;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 10));
        order.push(n);
        running--;
        if (fail) throw new Error(`job ${n}`);
        return n;
      });
    const results = await Promise.allSettled([job(1), job(2, true), job(3), job(4), job(5)]);
    expect(most).toBe(2);
    expect(order).toEqual([1, 2, 3, 4, 5]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled", "fulfilled", "fulfilled"]);
    // nothing is left holding a slot
    await expect(Promise.all([job(6), job(7)])).resolves.toEqual([6, 7]);
  });
});
