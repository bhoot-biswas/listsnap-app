import "server-only";
import { forWorkspace } from "@/server/db/scope";
import { backoffSeconds, failedSteps } from "@/server/db/worker";
import type { Workspace } from "@/server/db/workspaces";
import { autoScenes } from "@/server/pipeline/execute";
import { nextCalls, renderTarget, type NextCall } from "@/server/pipeline/next-calls";

/**
 * The steps of one job the worker may call now: exactly the browser's `next` list, from
 * the same saved state and the same nextCalls(), less any that failed too recently. A tab
 * retries a failed step at once; the worker waits 5 s, 30 s, then 2 min between attempts.
 */
export async function dueCalls(workspace: Workspace, jobId: string): Promise<NextCall[]> {
  const ws = forWorkspace(workspace.id);
  const job = await ws.getJob(jobId);
  if (!job || job.status !== "processing") return [];
  const [steps, listings, failed] = await Promise.all([
    ws.steps(jobId),
    ws.listings(jobId),
    failedSteps(workspace.id, jobId),
  ]);
  const calls = nextCalls({
    jobStatus: job.status,
    steps,
    listingIds: listings.map((l) => l.id),
    scenes: autoScenes(workspace, job.group_mode),
    translate: workspace.settings.listingLanguages.includes("bn"),
  });
  const waiting = new Set(
    failed.filter((f) => f.ago_s < backoffSeconds(f.attempts)).map((f) => `${f.step}|${f.target}`),
  );
  return calls.filter((c) => !waiting.has(`${c.step}|${targetOf(c)}`));
}

export const targetOf = (c: NextCall) =>
  c.kind === "job" ? "-" : c.step === "render" ? renderTarget(c.listingId, c.scene!) : c.listingId;
