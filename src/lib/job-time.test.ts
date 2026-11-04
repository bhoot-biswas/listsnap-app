import { describe, expect, it } from "vitest";
import { makingSeconds } from "./job-time";

const at = (s: number) => new Date(Date.UTC(2026, 10, 4, 12, 0, s)).toISOString();
const call = (step: string, s: number, ms = 2000) => ({ step, at: at(s), ms });

describe("makingSeconds", () => {
  it("is null before anything ran", () => {
    expect(makingSeconds(at(0), [])).toBeNull();
    expect(makingSeconds(at(0), [call("store", 1)])).toBeNull();
  });

  it("counts a job that ran straight through", () => {
    expect(makingSeconds(at(0), [call("plan", 1), call("write", 3), call("translate", 5)])).toBe(7);
  });

  // 401 s on the Done page for about 50 s of work
  it("leaves out the seller's time choosing items", () => {
    expect(makingSeconds(at(0), [call("group", 1), call("write", 33), call("translate", 35)])).toBe(7);
  });

  it("leaves out later store saves", () => {
    expect(makingSeconds(at(0), [call("plan", 1), call("write", 3), call("store", 50)])).toBe(5);
  });
});
