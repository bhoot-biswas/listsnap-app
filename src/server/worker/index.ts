import "server-only";
import { env } from "@/server/env";
import { dueWatches, workingJobs, type DueWork } from "@/server/db/worker";
import { workspaceById, type Workspace } from "@/server/db/workspaces";
import { executeJobStep, executeListingStep, executeWatchStep } from "@/server/pipeline/execute";
import { isDraining, MAX_ATTEMPTS } from "@/server/pipeline/run-step";
import type { Visitor } from "@/server/limits";
import type { NextCall } from "@/server/pipeline/next-calls";
import { dueCalls, targetOf } from "./plan";

/**
 * The server working through jobs by itself, so a closed tab or a locked phone no longer
 * stops them. It is one more caller of the same step functions the browser's calls reach,
 * under the same claims: a step a tab is running answers "running" here and is left alone,
 * and the other way round. Only the automatic pipeline (plan … render, a video's watch);
 * what the seller asks for by a button (looks, reels, posts, saves) stays theirs.
 *
 * PIPELINE_WORKER: off (the default), batches (only video batches and their jobs), all.
 */

/** Steps the worker runs at once across every shop; a tab's own calls come on top. */
export const STEPS_AT_ONCE = 3;
const TICK_MS = 3000;
// enough to find every working job on a busy day; they settle within minutes
const JOBS_PER_LOOK = 200;

interface WorkerState {
  running: number;
  /** step keys in flight here, so a slow step isn't started twice from this process */
  inFlight: Set<string>;
  timer: ReturnType<typeof setInterval> | null;
  looking: boolean;
}
const state = ((globalThis as { __listsnapWorker?: WorkerState }).__listsnapWorker ??= {
  running: 0,
  inFlight: new Set(),
  timer: null,
  looking: false,
});

type Work = { key: string; shop: string; run: () => Promise<unknown> };

/** Starts the loop when PIPELINE_WORKER says so; once per process. */
export function startWorker(): void {
  const mode = env().pipelineWorker;
  if (mode === "off" || state.timer) return;
  console.log(`[worker] working through ${mode === "all" ? "every job" : "video batches"}`);
  state.timer = setInterval(() => void round({ videoOnly: mode === "batches" }), TICK_MS);
  state.timer.unref?.();
}

/**
 * One look for due work, starting what fits under STEPS_AT_ONCE: one step per shop per
 * pass, so a twenty-photo bulk can't keep another seller's single snap waiting. Resolves
 * once the steps it started have finished (the tests wait on it; the loop doesn't).
 * `workspaceId` keeps a test to its own shop.
 */
export async function round(opts: { videoOnly: boolean; workspaceId?: string }): Promise<void> {
  if (state.looking || isDraining() || state.running >= STEPS_AT_ONCE) return;
  state.looking = true;
  const started: Promise<unknown>[] = [];
  try {
    const work = await findWork(opts);
    // one per shop per pass, in the order the work was found (oldest first)
    const byShop = new Map<string, Work[]>();
    for (const w of work) byShop.set(w.shop, [...(byShop.get(w.shop) ?? []), w]);
    while (state.running < STEPS_AT_ONCE && byShop.size) {
      for (const [shop, list] of byShop) {
        const next = list.shift();
        if (!list.length) byShop.delete(shop);
        if (!next || state.inFlight.has(next.key)) continue;
        if (state.running >= STEPS_AT_ONCE) break;
        started.push(launch(next));
      }
    }
  } catch (err) {
    console.error("[worker] looking for work failed:", err instanceof Error ? err.message : err);
  } finally {
    state.looking = false;
  }
  await Promise.allSettled(started);
}

function launch(w: Work): Promise<unknown> {
  state.running++;
  state.inFlight.add(w.key);
  return w
    .run()
    .catch((err) => console.error(`[worker] ${w.key} failed:`, err instanceof Error ? err.message : err))
    .finally(() => {
      state.running--;
      state.inFlight.delete(w.key);
    });
}

async function findWork(opts: { videoOnly: boolean; workspaceId?: string }): Promise<Work[]> {
  const shops = new Map<string, Workspace | null>();
  const shop = async (id: string) => {
    if (!shops.has(id)) shops.set(id, await workspaceById(id));
    return shops.get(id)!;
  };
  // a demo job from before visitors were kept would be charged to nobody: its tab drives it
  const visitor = (d: DueWork, workspace: Workspace): Visitor | null =>
    !workspace.isDemo ? "" : d.visitor_key ? { hash: d.visitor_key } : null;

  const work: Work[] = [];
  for (const b of await dueWatches({ workspaceId: opts.workspaceId, maxAttempts: MAX_ATTEMPTS })) {
    const workspace = await shop(b.workspace_id);
    const who = workspace && visitor(b, workspace);
    if (!workspace || who === null) continue;
    work.push({ key: `watch|${b.id}`, shop: b.workspace_id, run: () => executeWatchStep(workspace, b.id, who) });
  }
  for (const j of await workingJobs({ ...opts, limit: JOBS_PER_LOOK })) {
    const workspace = await shop(j.workspace_id);
    const who = workspace && visitor(j, workspace);
    if (!workspace || who === null) continue;
    for (const call of await dueCalls(workspace, j.id))
      work.push({
        key: `${j.id}|${call.step}|${targetOf(call)}`,
        shop: j.workspace_id,
        run: () => runCall(workspace, j.id, call, who),
      });
  }
  return work;
}

function runCall(workspace: Workspace, jobId: string, call: NextCall, who: Visitor) {
  return call.kind === "job"
    ? executeJobStep(workspace, jobId, call.step)
    : executeListingStep(workspace, call.listingId, call.step, { scene: call.scene, ip: who });
}
