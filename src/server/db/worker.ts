import "server-only";
import { select } from "./pool";

/**
 * What the step worker looks for: the only queries that look across shops, because the
 * server works through every shop's jobs. They return ids and nothing a seller wrote;
 * everything after that goes through forWorkspace() like any request.
 */

// the job is a day old: whoever started it has moved on, and a tab can still finish it
const MAX_AGE = "INTERVAL 1 DAY";

export interface DueWork {
  id: string;
  workspace_id: string;
  visitor_key: string | null;
}

/** Shops that still exist: an expired demo shop's jobs are left for its cleanup. */
const LIVE_SHOP =
  "JOIN workspaces w ON w.id = x.workspace_id AND (w.expires_at IS NULL OR w.expires_at > UTC_TIMESTAMP(3))";

/**
 * Jobs still at work, oldest first. Which of their steps are due is the job's own state's
 * to say (nextCalls), so this only narrows the search to the few jobs that can have any.
 * `videoOnly`: just the jobs a video batch made. A paused batch's jobs wait for its Resume.
 */
export function workingJobs(opts: { videoOnly: boolean; workspaceId?: string; limit: number }): Promise<DueWork[]> {
  return select<DueWork>(
    `SELECT x.id, x.workspace_id, x.visitor_key FROM jobs x ${LIVE_SHOP}
       ${opts.videoOnly ? "JOIN batches b ON b.id = x.batch_id AND b.video_media_id IS NOT NULL" : ""}
       LEFT JOIN batches pb ON pb.id = x.batch_id
      WHERE x.status = 'processing' AND x.created_at > UTC_TIMESTAMP(3) - ${MAX_AGE}
        AND pb.paused_at IS NULL
        ${opts.workspaceId ? "AND x.workspace_id = ?" : ""}
      ORDER BY x.created_at LIMIT ?`,
    [...(opts.workspaceId ? [opts.workspaceId] : []), opts.limit],
  );
}

/**
 * Video batches whose watch is due: never tried, failed with attempts left and past its
 * backoff (`backoffSql`), or running under a lock that ran out.
 */
export function dueWatches(opts: { workspaceId?: string; maxAttempts: number }): Promise<DueWork[]> {
  return select<DueWork>(
    `SELECT x.id, x.workspace_id, x.visitor_key FROM batches x ${LIVE_SHOP}
       JOIN batch_steps s ON s.batch_id = x.id AND s.step = 'watch' AND s.target = '-'
      WHERE x.video_media_id IS NOT NULL AND x.paused_at IS NULL AND x.created_at > UTC_TIMESTAMP(3) - ${MAX_AGE}
        ${opts.workspaceId ? "AND x.workspace_id = ?" : ""}
        AND (s.status = 'pending'
          OR (s.status = 'failed' AND s.attempts < ? AND s.finished_at < UTC_TIMESTAMP(3) - INTERVAL ${backoffSql} SECOND)
          OR (s.status = 'running' AND s.locked_until < UTC_TIMESTAMP(3)))
      ORDER BY x.created_at`,
    [...(opts.workspaceId ? [opts.workspaceId] : []), opts.maxAttempts],
  );
}

/**
 * What decides whether the worker would pick a job or batch up: how old it is, its kept
 * visitor, and whether it is (or belongs to) a video batch. Scoped to the shop, like a request.
 */
export async function workerFacts(
  workspaceId: string,
  kind: "job" | "batch",
  id: string,
): Promise<{ recent: boolean; visitor_key: string | null; from_video: boolean } | null> {
  const [row] = await select<{ recent: 0 | 1; visitor_key: string | null; from_video: 0 | 1 }>(
    kind === "job"
      ? `SELECT x.created_at > UTC_TIMESTAMP(3) - ${MAX_AGE} AS recent, x.visitor_key,
                (b.video_media_id IS NOT NULL) AS from_video
           FROM jobs x LEFT JOIN batches b ON b.id = x.batch_id
          WHERE x.id = ? AND x.workspace_id = ?`
      : `SELECT x.created_at > UTC_TIMESTAMP(3) - ${MAX_AGE} AS recent, x.visitor_key,
                (x.video_media_id IS NOT NULL) AS from_video
           FROM batches x WHERE x.id = ? AND x.workspace_id = ?`,
    [id, workspaceId],
  );
  return row ? { recent: !!row.recent, visitor_key: row.visitor_key, from_video: !!row.from_video } : null;
}

/** Seconds to wait after a failed attempt before the worker tries again: 5 s, 30 s, then 2 min. */
export const backoffSeconds = (attempts: number) => (attempts <= 1 ? 5 : attempts === 2 ? 30 : 120);
const backoffSql = "(CASE WHEN s.attempts <= 1 THEN 5 WHEN s.attempts = 2 THEN 30 ELSE 120 END)";

/** A job's failed steps and how long ago each failed, for the same backoff. */
export function failedSteps(
  workspaceId: string,
  jobId: string,
): Promise<{ step: string; target: string; attempts: number; ago_s: number }[]> {
  return select(
    `SELECT step, target, attempts, TIMESTAMPDIFF(SECOND, finished_at, UTC_TIMESTAMP(3)) AS ago_s
       FROM job_steps WHERE job_id = ? AND workspace_id = ? AND status = 'failed'`,
    [jobId, workspaceId],
  );
}
