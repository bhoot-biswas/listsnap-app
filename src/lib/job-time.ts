const BEFORE_CHOICE = new Set(["listen", "plan", "segment", "group"]);
const AFTER_CHOICE = new Set(["write", "translate", "render"]);

/**
 * Seconds ListSnap spent making a listing. The time a seller took to choose between
 * several items isn't ListSnap's, so the gap between the two halves of the job comes off.
 */
export function makingSeconds(createdAt: string, calls: { step: string; at: string; ms: number }[]): number | null {
  const made = calls.filter((c) => c.step !== "store");
  if (!made.length) return null;
  const start = (c: { at: string }) => Date.parse(c.at);
  const end = (c: { at: string; ms: number }) => start(c) + c.ms;
  const first = made.filter((c) => BEFORE_CHOICE.has(c.step));
  const second = made.filter((c) => AFTER_CHOICE.has(c.step));
  const waited =
    first.length && second.length ? Math.max(0, Math.min(...second.map(start)) - Math.max(...first.map(end))) : 0;
  const total = Math.max(...made.map(end)) - Date.parse(createdAt) - waited;
  return Math.max(1, Math.round(total / 1000));
}
