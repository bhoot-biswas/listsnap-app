import { afterAll, describe, expect, it, vi } from "vitest";
import { createTestWorkspace, dbEnv, samplePhoto, sampleVideo, createTestJob } from "./db-helpers";

/**
 * A bulk batch's Pause, kept on the server: set and cleared through the route, shown in
 * the batch's state, and obeyed by the server's own worker.
 */
const enabled = dbEnv();

const viewer = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/server/auth/session", () => ({ apiViewer: async () => viewer.current }));

describe.skipIf(!enabled)("bulk pause on the server (MariaDB)", async () => {
  const { execute, getPool, select } = await import("@/server/db/pool");
  const { forWorkspace } = await import("@/server/db/scope");
  const { saveMedia } = await import("@/server/media/store");
  const { loadBatchState } = await import("@/server/pipeline/batch-state");
  const { round } = await import("@/server/worker");
  const route = await import("@/app/api/batches/[id]/pause/route");

  const shop = await createTestWorkspace({ scenes: ["studio"], listingLanguages: ["en"] });
  const other = await createTestWorkspace();
  const ws = forWorkspace(shop.workspace.id);
  afterAll(async () => {
    await shop.remove();
    await other.remove();
    await getPool().end();
  });

  const setPaused = (batchId: string, body: unknown) =>
    route.POST(new Request(`http://x/api/batches/${batchId}/pause`, { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: batchId }),
    });
  const videoBatch = async () => {
    const media = await saveMedia(ws.id, "video", await sampleVideo(), {
      mime: "video/mp4",
      width: 0,
      height: 0,
      selected: false,
    });
    return ws.createVideoBatch(media.id);
  };
  const watchAttempts = async (batchId: string) =>
    Number(
      (await select<{ attempts: number }>("SELECT attempts FROM batch_steps WHERE batch_id = ?", [batchId]))[0]!
        .attempts,
    );

  it("pauses and resumes a batch, and only the shop's own", async () => {
    const batchId = await ws.createBatch(1);
    viewer.current = { workspace: shop.workspace };
    expect((await setPaused(batchId, { paused: true })).status).toBe(200);
    expect((await loadBatchState(shop.workspace, batchId))!.paused).toBe(true);
    expect((await setPaused(batchId, { paused: false })).status).toBe(200);
    expect((await loadBatchState(shop.workspace, batchId))!.paused).toBe(false);

    expect((await setPaused(batchId, { paused: "yes" })).status).toBe(400);
    viewer.current = { workspace: other.workspace };
    expect((await setPaused(batchId, { paused: true })).status).toBe(404);
    expect((await loadBatchState(shop.workspace, batchId))!.paused).toBe(false);
  });

  it("the worker doesn't watch a paused video, and does once it's resumed", async () => {
    const batchId = await videoBatch();
    await ws.setBatchPaused(batchId, true);
    await round({ videoOnly: true, workspaceId: ws.id });
    expect(await watchAttempts(batchId)).toBe(0);
    await ws.setBatchPaused(batchId, false);
    await round({ videoOnly: true, workspaceId: ws.id });
    expect(await watchAttempts(batchId)).toBe(1);
  });

  it("the worker doesn't start a paused batch's jobs", async () => {
    const batchId = await ws.createBatch(1);
    const jobId = await createTestJob(ws.id, await samplePhoto("saree.jpg"));
    await execute("UPDATE jobs SET batch_id = ? WHERE id = ?", [batchId, jobId]);
    await ws.setBatchPaused(batchId, true);
    await round({ videoOnly: false, workspaceId: ws.id });
    const plan = () =>
      select<{ attempts: number }>("SELECT attempts FROM job_steps WHERE job_id = ? AND step = 'plan'", [jobId]);
    expect(Number((await plan())[0]!.attempts)).toBe(0);
    await ws.setBatchPaused(batchId, false);
    await round({ videoOnly: false, workspaceId: ws.id });
    expect(Number((await plan())[0]!.attempts)).toBe(1);
  });
});
