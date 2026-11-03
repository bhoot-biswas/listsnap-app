import "server-only";

/**
 * Work that takes a whole CPU core and hundreds of MB for a while: ffmpeg on a video or a
 * voice note, a reel render. The server has two cores next to the database, and the app
 * is stopped at its memory cap, so at most this many run at once in the whole process;
 * the rest wait their turn. One object for the process: Next loads modules more than once.
 */
const AT_ONCE = 2;

interface Slots {
  busy: number;
  waiting: (() => void)[];
}
const slots = ((globalThis as { __listsnapHeavy?: Slots }).__listsnapHeavy ??= { busy: 0, waiting: [] });

export async function heavy<T>(fn: () => Promise<T>): Promise<T> {
  if (slots.busy >= AT_ONCE) await new Promise<void>((r) => slots.waiting.push(r));
  else slots.busy++;
  try {
    return await fn();
  } finally {
    // the slot passes straight to the next in line, so busy never drops and rises again
    const next = slots.waiting.shift();
    if (next) next();
    else slots.busy--;
  }
}
