/** Runs once when the server starts. Next sets NEXT_RUNTIME; the step code only exists in Node. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { stopGently } = await import("@/server/shutdown");
  stopGently();
  // works through jobs by itself when PIPELINE_WORKER says so; off by default
  const { startWorker } = await import("@/server/worker");
  startWorker();
}
