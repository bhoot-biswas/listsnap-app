import "server-only";
import { env } from "@/server/env";
import { drainSteps } from "@/server/pipeline/run-step";

/**
 * A deploy or restart stops the app with SIGTERM. Next would exit at once, cutting off a
 * reel mid-render or a post between Facebook's calls. With NEXT_MANUAL_SIG_HANDLE set
 * (listsnap.service) the signal is ours: new steps are turned away, pages keep answering,
 * and the process exits once the running steps are done, or after DRAIN_MS whatever is left.
 */
const DRAIN_MS = 60_000;

export function stopGently(): void {
  if (!env().drainOnStop) return;
  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(`[shutdown] ${signal}: finishing running steps before exit`);
    const left = await drainSteps(DRAIN_MS);
    if (left) console.warn(`[shutdown] ${left} step(s) still running after ${DRAIN_MS / 1000} s; exiting anyway`);
    // what Next itself exits with on SIGTERM, which the unit counts as a clean stop
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
