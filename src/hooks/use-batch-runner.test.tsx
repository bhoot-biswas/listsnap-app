// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchState } from "@/lib/batch-state";

/** The bulk runner and the batch's Pause, which is kept on the server. */
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./use-wake-lock", () => ({ useWakeLock: () => {} }));
vi.mock("./use-done-cue", () => ({ useDoneCue: () => {} }));

const { useBatchRunner } = await import("./use-batch-runner");

const batch = (paused: boolean): BatchState =>
  ({
    id: "b",
    total: 1,
    createdAt: "",
    watch: null,
    paused,
    rows: [{ jobId: "j", jobStatus: "processing", next: [{ key: "plan", url: "/api/jobs/j/steps/plan" }] }],
  }) as unknown as BatchState;

let server: BatchState;
const posts: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  posts.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(`${url} ${init.body ?? ""}`);
        if (url.endsWith("/pause")) server = batch(JSON.parse(String(init.body)).paused);
        return new Response(null, { status: 202 });
      }
      return new Response(JSON.stringify(server), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bulk runner and the batch's Pause", () => {
  it("doesn't start a batch that was paused, here or on another device", async () => {
    server = batch(true);
    const { result } = renderHook(() => useBatchRunner(batch(true), false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(posts).toEqual([]);
    expect(result.current.paused).toBe(true);
  });

  it("stops starting steps once another device pauses it", async () => {
    server = batch(false);
    const { result } = renderHook(() => useBatchRunner(batch(false), true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(posts.some((p) => p.includes("/steps/plan"))).toBe(true);
    server = batch(true);
    const before = posts.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.paused).toBe(true);
    expect(posts.length - before).toBeLessThanOrEqual(1);
  });

  it("keeps Pause and Resume on the batch", async () => {
    server = batch(false);
    const { result } = renderHook(() => useBatchRunner(batch(false), true));
    await act(async () => {
      result.current.pause();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(posts.at(-1)).toBe('/api/batches/b/pause {"paused":true}');
    await act(async () => {
      await result.current.resume();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(posts).toContain('/api/batches/b/pause {"paused":false}');
  });

  it("only reads the state when the server's worker works the batch", async () => {
    server = batch(false);
    renderHook(() => useBatchRunner(batch(false), true, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(posts).toEqual([]);
  });
});
