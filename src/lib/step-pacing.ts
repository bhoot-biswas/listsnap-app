/**
 * How long the step runners wait before asking again, from the answers their step calls
 * got. A held lock or a step that failed with attempts left is a normal pause. Any other
 * answer (a 404, a 409, a 500) won't change by asking again at once, so the wait doubles
 * each round, and after STALL_AFTER such rounds in a row the runner stops and offers Try
 * again: one stuck step must not have every open tab call the server nonstop.
 */

const BUSY_MS = 1500;
const RETRY_MS = 2000;
const FIRST_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
// 1 + 2 + 4 + 8 + 16 + 30 s: about a minute of a server that keeps refusing
export const STALL_AFTER = 6;

export interface Pace {
  /** Milliseconds to wait before loading the state again. */
  wait: number;
  /** Rounds in a row that got an unexpected answer; carried into the next call. */
  errors: number;
  /** Too many of those: stop and let the seller try again. */
  stall: boolean;
}

/** `statuses` are this round's HTTP statuses, 0 for a request that never got an answer. */
export function pace(statuses: number[], errors: number): Pace {
  const unexpected = statuses.some((st) => st !== 0 && st !== 200 && st !== 202 && st !== 422);
  if (unexpected) {
    const next = errors + 1;
    return {
      wait: Math.min(FIRST_BACKOFF_MS * 2 ** errors, MAX_BACKOFF_MS),
      errors: next,
      stall: next >= STALL_AFTER,
    };
  }
  if (statuses.includes(202)) return { wait: BUSY_MS, errors: 0, stall: false };
  if (statuses.some((st) => st === 422 || st === 0)) return { wait: RETRY_MS, errors: 0, stall: false };
  return { wait: 0, errors: 0, stall: false };
}
