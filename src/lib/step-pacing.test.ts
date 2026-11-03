import { describe, expect, it } from "vitest";
import { pace, STALL_AFTER } from "./step-pacing";

describe("how long the step runners wait", () => {
  it("doesn't wait after steps that answered, and pauses for a held lock or a retryable failure", () => {
    expect(pace([200, 200], 0)).toEqual({ wait: 0, errors: 0, stall: false });
    expect(pace([200, 202], 0)).toEqual({ wait: 1500, errors: 0, stall: false });
    expect(pace([422], 0)).toEqual({ wait: 2000, errors: 0, stall: false });
    expect(pace([0], 0)).toEqual({ wait: 2000, errors: 0, stall: false });
  });

  it("doubles the wait for answers that asking again won't change, then stops", () => {
    const waits: number[] = [];
    let errors = 0;
    let stall = false;
    while (!stall) {
      const p = pace([500], errors);
      waits.push(p.wait);
      ({ errors, stall } = p);
    }
    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
    expect(errors).toBe(STALL_AFTER);
  });

  it("starts counting again once a round goes through", () => {
    expect(pace([404], 3).errors).toBe(4);
    expect(pace([200], 4).errors).toBe(0);
    // one stuck call among good ones still counts
    expect(pace([200, 409], 0)).toMatchObject({ wait: 1000, errors: 1 });
  });
});
