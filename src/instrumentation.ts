/** Runs once when the server starts. Next sets NEXT_RUNTIME; the step code only exists in Node. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { stopGently } = await import("@/server/shutdown");
  stopGently();
}
