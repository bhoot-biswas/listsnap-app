/**
 * Bangladesh is UTC+6 all year, with no daylight saving, so its calendar day is the UTC
 * clock moved on six hours. Stats and the daily limits count days the way sellers do,
 * from midnight in Dhaka.
 */
export const DHAKA_OFFSET_MS = 6 * 3_600_000;

/** The Dhaka date, as YYYY-MM-DD, `daysAgo` days before `now`. */
export function dhakaDay(now: Date | number = Date.now(), daysAgo = 0): string {
  return new Date(Number(now) + DHAKA_OFFSET_MS - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** The next midnight in Dhaka, when the daily limits start again. */
export function nextDhakaMidnight(now: Date | number = Date.now()): Date {
  return new Date(Date.parse(`${dhakaDay(now)}T00:00:00Z`) + 86_400_000 - DHAKA_OFFSET_MS);
}
