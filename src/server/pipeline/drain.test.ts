import { afterAll, describe, expect, it } from "vitest";
import { drainSteps, runStep, type StepKey, type StepRow, type StepStore } from "./run-step";

/**
 * Stopping the server: steps already working finish, new ones are turned away as if
 * another process held them. Its own file, because draining is for the whole process.
 */
function store(): StepStore {
  const rows = new Map<string, StepRow>();
  const id = (k: StepKey) => `${k.jobId}|${k.step}|${k.target}`;
  return {
    async ensure(k) {
      if (!rows.has(id(k)))
        rows.set(id(k), { status: "pending", attempts: 0, lastError: null, result: null, lockValid: false });
    },
    async get(k) {
      return rows.get(id(k)) ?? null;
    },
    async claim(k) {
      const r = rows.get(id(k))!;
      if (r.status !== "pending") return null;
      Object.assign(r, { status: "running", attempts: 1, lockValid: true });
      return "t";
    },
    async renew() {},
    async complete(k, _t, result) {
      Object.assign(rows.get(id(k))!, { status: "done", result, lockValid: false });
      return true;
    },
    async fail() {
      return true;
    },
    async abandon() {},
    async reset() {},
  };
}

describe("draining steps on shutdown", () => {
  // the flag is the process's; other test files may run in this one after
  afterAll(() => {
    (globalThis as { __listsnapSteps?: { draining: boolean } }).__listsnapSteps!.draining = false;
  });

  it("lets a running step finish, turns new ones away, and says what still runs when time is up", async () => {
    const s = store();
    const opts = { lockMs: 60_000 };
    let finish!: (v: string) => void;
    const running = runStep(
      s,
      { jobId: "j", step: "a", target: "-" },
      opts,
      () => new Promise<string>((r) => (finish = r)),
    );
    // let the claim happen before the drain starts
    await new Promise((r) => setTimeout(r, 10));

    const drained = drainSteps(5_000, 5);
    let started = false;
    const turnedAway = await runStep(s, { jobId: "j", step: "b", target: "-" }, opts, async () => {
      started = true;
      return "b";
    });
    expect(turnedAway).toEqual({ state: "running" });
    expect(started).toBe(false);
    // a wait that runs out reports the step still at work
    expect(await drainSteps(20, 5)).toBe(1);

    finish("a");
    expect(await running).toEqual({ state: "done", result: "a", fresh: true });
    expect(await drained).toBe(0);
  });
});
