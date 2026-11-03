import "server-only";
import { env } from "@/server/env";
import { workerFacts } from "@/server/db/worker";
import type { Workspace } from "@/server/db/workspaces";

/**
 * Whether the server's own worker works this job or batch through, so its page only has
 * to watch. The same rules the worker picks work by: it is on, the work is less than a
 * day old, a demo shop's work has its visitor kept, and with PIPELINE_WORKER=batches it
 * comes from a video. Anything else is still driven by the page, as before the worker.
 */
export async function workerCovers(workspace: Workspace, kind: "job" | "batch", id: string): Promise<boolean> {
  const mode = env().pipelineWorker;
  if (mode === "off") return false;
  const facts = await workerFacts(workspace.id, kind, id);
  if (!facts?.recent) return false;
  if (workspace.isDemo && !facts.visitor_key) return false;
  return mode === "all" || facts.from_video;
}
