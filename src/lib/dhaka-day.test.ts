import { describe, expect, it } from "vitest";
import { dhakaDay, nextDhakaMidnight } from "./dhaka-day";

describe("dhakaDay", () => {
  it("turns over at midnight in Dhaka, which is 18:00 UTC", () => {
    expect(dhakaDay(Date.parse("2026-11-01T17:59:00Z"))).toBe("2026-11-01");
    expect(dhakaDay(Date.parse("2026-11-01T18:00:00Z"))).toBe("2026-11-02");
    // 1 AM in Dhaka is still the previous day in UTC; the seller's "today" is the new one
    expect(dhakaDay(Date.parse("2026-11-01T19:00:00Z"))).toBe("2026-11-02");
  });

  it("counts back whole days", () => {
    expect(dhakaDay(Date.parse("2026-11-01T19:00:00Z"), 1)).toBe("2026-11-01");
    expect(dhakaDay(Date.parse("2026-11-01T19:00:00Z"), 6)).toBe("2026-10-27");
  });
});

describe("nextDhakaMidnight", () => {
  it("is the coming midnight in Dhaka (18:00 UTC), whichever side of UTC midnight it is", () => {
    expect(nextDhakaMidnight(Date.parse("2026-11-03T10:00:00Z")).toISOString()).toBe("2026-11-03T18:00:00.000Z");
    // 01:00 in Dhaka on the 4th is still the 3rd in UTC
    expect(nextDhakaMidnight(Date.parse("2026-11-03T19:00:00Z")).toISOString()).toBe("2026-11-04T18:00:00.000Z");
  });
});
