// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobState } from "@/lib/job-state";

/**
 * The job runner against a server whose step call keeps failing: it must slow down and
 * then stop with Try again, instead of calling nonstop from every open tab.
 */
// one router for every render, as Next's is
const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./use-wake-lock", () => ({ useWakeLock: () => {} }));
vi.mock("./use-done-cue", () => ({ useDoneCue: () => {} }));

const { useJobRunner } = await import("./use-job-runner");

const state = { id: "j", status: "processing", next: [{ url: "/api/jobs/j/steps/plan" }] } as unknown as JobState;
let posts = 0;

beforeEach(() => {
  vi.useFakeTimers();
  posts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts++;
        return new Response(null, { status: 500 });
      }
      return new Response(JSON.stringify(state), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("job runner when a step keeps failing", () => {
  it("backs off between tries and stops with Try again after about a minute", async () => {
    const { result } = renderHook(() => useJobRunner(state));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // 1 + 2 + 4 s of waits fit in the first 10 s: four calls, not hundreds
    expect(posts).toBe(4);
    expect(result.current.stalled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(posts).toBe(6);
    expect(result.current.stalled).toBe(true);

    // stopped: nothing more until the seller taps Try again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(posts).toBe(6);
  });
});
