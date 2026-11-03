import { afterAll, describe, expect, it } from "vitest";
import { createTestJob, createTestWorkspace, dbEnv, runJob, samplePhoto, sampleVideo } from "./db-helpers";

/**
 * The step worker: the server working a job through to Review with no browser, never
 * doing a step twice when a tab drives the same job, waiting between failed attempts,
 * and leaving alone what it shouldn't touch. Each test keeps the worker to its own shop.
 */
const enabled = dbEnv();

describe.skipIf(!enabled)("step worker (MariaDB)", async () => {
  const { execute, getPool, select, selectOne } = await import("@/server/db/pool");
  const { round } = await import("@/server/worker");
  const { dueCalls } = await import("@/server/worker/plan");
  const { loadJobState } = await import("@/server/pipeline/job-state");
  const { executeJobStep } = await import("@/server/pipeline/execute");
  const { forWorkspace } = await import("@/server/db/scope");
  const { saveMedia } = await import("@/server/media/store");

  const shops: { remove: () => Promise<unknown> }[] = [];
  afterAll(async () => {
    for (const s of shops) await s.remove();
    await getPool().end();
  });
  const newShop = async () => {
    const shop = await createTestWorkspace({ scenes: ["studio"], listingLanguages: ["en"] });
    shops.push(shop);
    return shop.workspace;
  };
  /** Rounds until the job leaves Processing, as the loop would every few seconds. */
  const work = async (workspaceId: string, jobId: string, max = 30) => {
    for (let i = 0; i < max; i++) {
      await round({ videoOnly: false, workspaceId });
      const job = await selectOne<{ status: string }>("SELECT status FROM jobs WHERE id = ?", [jobId]);
      if (job!.status !== "processing") return job!.status;
    }
    return "processing";
  };
  const attempts = (jobId: string) =>
    select<{ step: string; target: string; attempts: number; status: string }>(
      "SELECT step, target, attempts, status FROM job_steps WHERE job_id = ? ORDER BY step, target",
      [jobId],
    );

  it("works a job through to Review with no browser, each step once", async () => {
    const workspace = await newShop();
    const jobId = await createTestJob(workspace.id, await samplePhoto("saree.jpg"));
    expect(await work(workspace.id, jobId)).toBe("ready");
    const steps = await attempts(jobId);
    expect(steps.map((s) => s.step)).toEqual(expect.arrayContaining(["plan", "segment", "group", "write", "render"]));
    expect(steps.every((s) => s.status === "done" && s.attempts === 1)).toBe(true);
    const state = await loadJobState(workspace, jobId);
    expect(state!.next).toEqual([]);
  });

  it("never does a step twice when a tab drives the same job at the same time", async () => {
    const workspace = await newShop();
    const jobId = await createTestJob(workspace.id, await samplePhoto("kurti.jpg"));
    // the tab and the worker both go at the first step, then both keep going
    await Promise.all([
      executeJobStep(workspace, jobId, "plan"),
      round({ videoOnly: false, workspaceId: workspace.id }),
    ]);
    await Promise.all([runJob(workspace, jobId), work(workspace.id, jobId)]);
    const steps = await attempts(jobId);
    expect(steps.every((s) => s.status === "done" && s.attempts === 1)).toBe(true);
    const calls = await select<{ step: string; n: number }>(
      "SELECT step, COUNT(*) AS n FROM api_calls WHERE job_id = ? AND step IN ('plan', 'segment') GROUP BY step",
      [jobId],
    );
    expect(calls.map((c) => Number(c.n))).toEqual([1, 1]);
  });

  it("waits after a failed attempt before trying it again", async () => {
    const workspace = await newShop();
    const jobId = await createTestJob(workspace.id, await samplePhoto("saree.jpg"));
    await execute(
      "UPDATE job_steps SET status = 'failed', attempts = 1, finished_at = UTC_TIMESTAMP(3) WHERE job_id = ? AND step = 'plan'",
      [jobId],
    );
    expect(await dueCalls(workspace, jobId)).toEqual([]);
    await execute(
      "UPDATE job_steps SET finished_at = UTC_TIMESTAMP(3) - INTERVAL 6 SECOND WHERE job_id = ? AND step = 'plan'",
      [jobId],
    );
    expect(await dueCalls(workspace, jobId)).toEqual([{ kind: "job", step: "plan" }]);
  });

  it("leaves a demo job without a kept visitor to its tab, and works one with a visitor", async () => {
    const workspace = await newShop();
    await execute("UPDATE workspaces SET is_demo = 1 WHERE id = ?", [workspace.id]);
    const jobId = await createTestJob(workspace.id, await samplePhoto("saree.jpg"));
    await round({ videoOnly: false, workspaceId: workspace.id });
    expect((await attempts(jobId)).every((s) => s.attempts === 0)).toBe(true);

    await execute("UPDATE jobs SET visitor_key = ? WHERE id = ?", ["a".repeat(64), jobId]);
    await round({ videoOnly: false, workspaceId: workspace.id });
    expect((await attempts(jobId)).find((s) => s.step === "plan")!.attempts).toBe(1);
    await execute("DELETE FROM ip_daily WHERE ip_hash = ?", ["a".repeat(64)]);
  });

  it("with only video batches on, leaves a photo job alone", async () => {
    const workspace = await newShop();
    const jobId = await createTestJob(workspace.id, await samplePhoto("saree.jpg"));
    await round({ videoOnly: true, workspaceId: workspace.id });
    expect((await attempts(jobId)).every((s) => s.attempts === 0)).toBe(true);
  });

  it("leaves a day-old job alone", async () => {
    const workspace = await newShop();
    const jobId = await createTestJob(workspace.id, await samplePhoto("saree.jpg"));
    await execute("UPDATE jobs SET created_at = UTC_TIMESTAMP(3) - INTERVAL 25 HOUR WHERE id = ?", [jobId]);
    await round({ videoOnly: false, workspaceId: workspace.id });
    expect((await attempts(jobId)).every((s) => s.attempts === 0)).toBe(true);
  });

  it("with only video batches on, watches a video and works its jobs through", async () => {
    const workspace = await newShop();
    const ws = forWorkspace(workspace.id);
    const media = await saveMedia(ws.id, "video", await sampleVideo(), {
      mime: "video/mp4",
      width: 0,
      height: 0,
      selected: false,
    });
    const batchId = await ws.createVideoBatch(media.id);
    for (let i = 0; i < 40; i++) {
      await round({ videoOnly: true, workspaceId: workspace.id });
      const open = await select("SELECT id FROM jobs WHERE batch_id = ? AND status = 'processing'", [batchId]);
      if ((await ws.batchJobIds(batchId)).length && !open.length) break;
    }
    const jobs = await select<{ status: string }>("SELECT status FROM jobs WHERE batch_id = ?", [batchId]);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.status === "ready")).toBe(true);
  });
});
