import { describe, expect, it } from "vitest";
import { renderLine } from "./live";

describe("the reel render line", () => {
  it("renders one at a time and turns away a request past the line's length", async () => {
    const line = renderLine(2);
    const order: string[] = [];
    let release!: () => void;
    const first = line(() => new Promise<void>((r) => (release = r)).then(() => void order.push("a")));
    const second = line(async () => void order.push("b"));
    await expect(line(async () => "c")).rejects.toMatchObject({ key: "reelsBusy", notAttempted: true });

    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["a", "b"]);
    // room again once those are done, also after one that failed
    await expect(line(async () => Promise.reject(new Error("render failed")))).rejects.toThrow("render failed");
    await expect(line(async () => "d")).resolves.toBe("d");
  });
});
